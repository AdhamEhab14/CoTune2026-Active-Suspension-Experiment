"""Stream controller for the CO-Tune live experiments.

Runs on the lab/hardware host (same machine as OBS Studio).
Subscribes to AWS IoT MQTT topics and toggles the OBS Twitch broadcast
when students click "Start Live" on the website.
"""

import json
import logging
import os
import pathlib
import ssl
import threading
import time

import paho.mqtt.client as mqtt
from dotenv import load_dotenv
from obsws_python import ReqClient

SCRIPT_DIR = pathlib.Path(__file__).parent.resolve()
load_dotenv(SCRIPT_DIR / ".env")


def _resolve(p: str) -> str:
    path = pathlib.Path(p)
    return str(path if path.is_absolute() else (SCRIPT_DIR / path).resolve())


AWS_IOT_ENDPOINT = os.environ.get(
    "AWS_IOT_ENDPOINT", "a3c1jrwyyxkjx6-ats.iot.eu-west-3.amazonaws.com"
)
AWS_IOT_PORT = int(os.environ.get("AWS_IOT_PORT", "8883"))
AWS_IOT_CA = _resolve(os.environ["AWS_IOT_CA"])
AWS_IOT_CERT = _resolve(os.environ["AWS_IOT_CERT"])
AWS_IOT_KEY = _resolve(os.environ["AWS_IOT_KEY"])
AWS_IOT_CLIENT_ID = os.environ.get("AWS_IOT_CLIENT_ID", "stream-controller")

MQTT_TOPICS = [
    t.strip()
    for t in os.environ.get("MQTT_TOPICS", "ROTARY/Stream").split(",")
    if t.strip()
]

OBS_HOST = os.environ.get("OBS_HOST", "localhost")
OBS_PORT = int(os.environ.get("OBS_PORT", "4455"))
OBS_PASSWORD = os.environ.get("OBS_PASSWORD", "")

IDLE_STOP_SECONDS = int(os.environ.get("IDLE_STOP_SECONDS", "600"))

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("stream-controller")


class StreamSupervisor:
    def __init__(self):
        self._lock = threading.Lock()
        self._last_keepalive = 0.0
        self._streaming = False
        self._stop_event = threading.Event()

    def _obs(self):
        return ReqClient(
            host=OBS_HOST, port=OBS_PORT, password=OBS_PASSWORD, timeout=5
        )

    def _is_streaming(self):
        try:
            with self._obs() as obs:
                return obs.get_stream_status().output_active
        except Exception as e:
            log.error("OBS status check failed: %s", e)
            return self._streaming

    def start(self):
        with self._lock:
            self._last_keepalive = time.time()
            if self._is_streaming():
                log.info("Stream already live, refreshing keepalive only.")
                self._streaming = True
                return
            try:
                with self._obs() as obs:
                    obs.start_stream()
                self._streaming = True
                log.info("OBS stream started.")
            except Exception as e:
                log.exception("Failed to start OBS stream: %s", e)

    def stop(self):
        with self._lock:
            try:
                with self._obs() as obs:
                    obs.stop_stream()
                self._streaming = False
                log.info("OBS stream stopped.")
            except Exception as e:
                log.exception("Failed to stop OBS stream: %s", e)

    def watchdog(self):
        while not self._stop_event.is_set():
            time.sleep(15)
            with self._lock:
                streaming = self._streaming
                idle = time.time() - self._last_keepalive
            if streaming and IDLE_STOP_SECONDS > 0 and idle >= IDLE_STOP_SECONDS:
                log.info("Idle for %.0fs, stopping stream.", idle)
                self.stop()

    def shutdown(self):
        self._stop_event.set()


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        log.info("Connected to AWS IoT (%s)", AWS_IOT_ENDPOINT)
        for topic in MQTT_TOPICS:
            client.subscribe(topic, qos=0)
            log.info("Subscribed to %s", topic)
    else:
        log.error("MQTT connect failed: rc=%s", rc)


def on_message(client, userdata, msg):
    supervisor: StreamSupervisor = userdata["supervisor"]
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except Exception:
        log.warning("Non-JSON message on %s, ignoring.", msg.topic)
        return

    cmd = (payload.get("cmd") or "start").lower()
    log.info("Received %s on %s: %s", cmd, msg.topic, payload)
    if cmd == "start":
        supervisor.start()
    elif cmd == "stop":
        supervisor.stop()
    else:
        log.warning("Unknown command: %s", cmd)


def main():
    supervisor = StreamSupervisor()
    watchdog = threading.Thread(target=supervisor.watchdog, daemon=True)
    watchdog.start()

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION1,
        client_id=AWS_IOT_CLIENT_ID,
        userdata={"supervisor": supervisor},
        protocol=mqtt.MQTTv311,
    )
    client.tls_set(
        ca_certs=AWS_IOT_CA,
        certfile=AWS_IOT_CERT,
        keyfile=AWS_IOT_KEY,
        tls_version=ssl.PROTOCOL_TLSv1_2,
    )
    client.on_connect = on_connect
    client.on_message = on_message

    log.info(
        "Connecting to %s:%s as %s",
        AWS_IOT_ENDPOINT,
        AWS_IOT_PORT,
        AWS_IOT_CLIENT_ID,
    )
    client.connect(AWS_IOT_ENDPOINT, AWS_IOT_PORT, keepalive=60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        supervisor.shutdown()
        client.disconnect()


if __name__ == "__main__":
    main()
