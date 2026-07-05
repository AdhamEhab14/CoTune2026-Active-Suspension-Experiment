# Stream Controller (lab/hardware host)

Runs on the machine that broadcasts the experiment to Twitch via OBS.
Listens for `{"cmd":"start"}` / `{"cmd":"stop"}` messages on AWS IoT
MQTT — published by the website when a student clicks **Start Live** —
and tells OBS to begin/end streaming.

## How it fits together

```
 Student browser            AWS IoT (eu-west-3)          Lab PC
 ─────────────────         ──────────────────────       ──────────────
 RotaryLive page  ──MQTT──>  ROTARY/Stream  ──MQTT──>  stream_controller.py
 (Start Live btn)            {"cmd":"start"}            │
                                                        │ OBS WebSocket
                                                        ▼
                                                       OBS Studio ──RTMP──> Twitch (cotune26)
                                                                                │
 Student watches  <───── HLS ─────────── player.twitch.tv ◄──────────────────────┘
 in <iframe>
```

## Prerequisites

- **OBS Studio 28+** with the built-in WebSocket server.
- Twitch stream key already configured in OBS (`Settings → Stream → Twitch`).
- Python 3.9+

## Setup

### 1. AWS IoT credentials

In the AWS console (region **eu-west-3**), create an IoT Thing for this
host (e.g. `cotune-broadcaster-lab1`). Download:

- the device certificate (`*.pem.crt`)
- the private key (`*.private.key`)
- the Amazon Root CA (`AmazonRootCA1.pem`)

Drop them in `./certs/`.

Attach an IoT policy that allows at minimum:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["iot:Connect"], "Resource": "*" },
    { "Effect": "Allow", "Action": ["iot:Subscribe","iot:Receive"], "Resource": "*" }
  ]
}
```

(Tighten the resource ARNs to the specific topic later — `*` is fine
for a single-tenant lab device.)

### 2. OBS WebSocket

In OBS: `Tools → WebSocket Server Settings`. Enable it, set a password,
and copy that password into `.env`. Default port is `4455`.

### 3. Python deps

```bash
python -m venv .venv
. .venv/bin/activate         # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure

```bash
cp .env.example .env
# edit .env with your paths/password
```

### 5. Run

```bash
python stream_controller.py
```

You should see:

```
[INFO] Connecting to a3c1jrwyyxkjx6-ats.iot.eu-west-3.amazonaws.com:8883 ...
[INFO] Connected to AWS IoT
[INFO] Subscribed to ROTARY/Stream
```

## Verifying end-to-end

1. Start the script — confirm `Subscribed to ROTARY/Stream`.
2. Open the website's Rotary Live page, click **Start Live**.
3. The script logs `Received start on ROTARY/Stream` and `OBS stream
   started`. OBS's status bar shows "LIVE".
4. The student's Twitch iframe (`cotune26`) switches from OFFLINE to
   live within ~10 s (the usual Twitch ingest delay).

## Behavior notes

- `cmd: "start"` is **idempotent** — re-clicking Start Live just resets
  the keepalive; OBS isn't restarted.
- `IDLE_STOP_SECONDS` (default 600 s) is a safety net: if no fresh
  `start` arrives for that long, OBS is stopped automatically so the
  channel isn't left broadcasting an empty rig overnight. Each student
  click refreshes the timer. Set to `0` to disable.
- The website only publishes `start` today. To stop on demand, publish
  `{"cmd":"stop"}` to the same topic (e.g. from the queue-expiry
  handler).

## Run on boot (Linux, systemd)

`/etc/systemd/system/cotune-stream.service`:

```ini
[Unit]
Description=CO-Tune stream controller
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/cotune-stream
ExecStart=/opt/cotune-stream/.venv/bin/python stream_controller.py
Restart=on-failure
User=lab

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now cotune-stream`.

## Extending to other experiments

Each Live page on the website should publish to its own topic so the
broadcaster can pick the right OBS scene per experiment. Pattern:

| Page             | Twitch channel | Suggested MQTT topic |
| ---------------- | -------------- | -------------------- |
| RotaryLive       | cotune26       | ROTARY/Stream        |
| SuspensionLive   | cotune26       | SUSPENSION/Stream    |
| furutaExperiment | cotune_team    | INVERTED/Stream      |

Add the topic to `MQTT_TOPICS` in `.env` (comma-separated). For
multi-channel setups you'll likely run one `stream_controller.py` per
broadcaster host (one per Twitch channel).
