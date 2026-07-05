/* Includes_BEGIN */
#include <math.h>

#ifndef MATLAB_MEX_FILE
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
// FIXED: Removed the extra double quotes
#include "C:\Users\omar fathy\Desktop\University\Graduation Project\rotary_cloud\secrets.h"

extern "C" void arduino_esp_crt_bundle_attach(void *conf) {}

static WiFiClientSecure net;
static PubSubClient client(net);

// Data
static float g_cloud_K[4] = {0, 0, 0, 0};

// State Logic Variables
static bool g_system_active = false;
static bool g_control_active = false;
static unsigned long g_start_time = 0;

// Rotary Pendulum States: a1 (Arm), a2 (Pendulum), v1 (Arm Vel), v2 (Pend Vel), u
static float g_sim_a1 = 0, g_sim_a2 = 0, g_sim_v1 = 0, g_sim_v2 = 0, g_sim_u = 0;

static portMUX_TYPE g_mqttMux = portMUX_INITIALIZER_UNLOCKED;

static void mqttCallback(char *topic, byte *payload, unsigned int length)
{
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length))
    {
        Serial.println("[ERROR] Failed to parse incoming JSON!");
        return;
    }

    const char *cmd = doc["command"];
    if (!cmd)
        return;

    bool print_start = false;
    bool print_stop = false;

    portENTER_CRITICAL(&g_mqttMux);
    if (strcmp(cmd, "START") == 0)
    {
        g_cloud_K[0] = doc["K"][0];
        g_cloud_K[1] = doc["K"][1];
        g_cloud_K[2] = doc["K"][2];
        g_cloud_K[3] = doc["K"][3];

        g_system_active = true;
        g_control_active = false;
        g_start_time = millis();
        print_start = true;
    }
    else if (strcmp(cmd, "STOP") == 0)
    {
        g_system_active = false;
        g_control_active = false;
        print_stop = true;
    }
    portEXIT_CRITICAL(&g_mqttMux);

    // --- SAFE TO PRINT DOWN HERE ---
    if (print_start)
    {
        Serial.println("\n=================================");
        Serial.println(" --- ROTARY PENDULUM STARTED ---");
        Serial.println("=================================");
        Serial.printf("[AWS DATA] K-Matrix: [%.2f, %.2f, %.2f, %.2f]\n",
                      doc["K"][0].as<float>(), doc["K"][1].as<float>(), doc["K"][2].as<float>(), doc["K"][3].as<float>());
        Serial.println("\n[STATE] Phase 1: Waiting 10 seconds.");
        Serial.println("[STATE] Simulink status -> Controllers: OFF");
        Serial.println("[STATE] Telemetry muted until Phase 2...\n");
    }
    if (print_stop)
    {
        Serial.println("\n[COMMAND] STOP received. System halted.");
        Serial.println("[STATE] Simulink status -> Controllers: OFF\n");
    }
}

static void CloudTask(void *param)
{
    Serial.begin(115200);
    delay(2000);
    Serial.println("\n--- Initializing Rotary Cloud Task ---");

    net.setCACert(AWS_CERT_CA);
    net.setCertificate(AWS_CERT_CRT);
    net.setPrivateKey(AWS_CERT_PRIVATE);
    client.setServer(AWS_IOT_ENDPOINT, 8883);
    client.setCallback(mqttCallback);

    WiFi.begin(SECRET_SSID, SECRET_PASS);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20)
    {
        vTaskDelay(pdMS_TO_TICKS(1000));
        Serial.print(".");
        retries++;
    }
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("\n[ERROR] WiFi Failed! Restarting...");
        ESP.restart();
    }
    Serial.println("\n[NETWORK] WiFi Connected!");

    while (1)
    {
        if (!client.connected())
        {
            Serial.println("[NETWORK] Attempting MQTT Connection...");
            if (client.connect("rotary-policy"))
            {
                // MATCHING REACT TOPIC
                client.subscribe("ROTARY/Parameters");
                Serial.println("[NETWORK] MQTT Connected to ROTARY/Parameters!");
            }
            else
            {
                Serial.print("[ERROR] MQTT Connection Failed. State: ");
                Serial.println(client.state());
                vTaskDelay(pdMS_TO_TICKS(1000));
            }
        }
        client.loop();

        bool print_engage = false;
        bool is_publishing = false;

        portENTER_CRITICAL(&g_mqttMux);
        if (g_system_active)
        {
            unsigned long elapsed = millis() - g_start_time;

            // Unlock telemetry after exactly 10 seconds
            if (elapsed >= 10000)
            {
                is_publishing = true;
            }

            // Trigger Swing-up/LQR after exactly 10 seconds
            if (elapsed >= 10000 && !g_control_active)
            {
                g_control_active = true;
                print_engage = true;
            }
        }

        float a1 = g_sim_a1, a2 = g_sim_a2, v1 = g_sim_v1, v2 = g_sim_v2, u = g_sim_u;
        portEXIT_CRITICAL(&g_mqttMux);

        if (print_engage)
        {
            Serial.println("\n[STATE] *** Phase 2 Engaged ***");
            Serial.println("[STATE] Simulink status -> Controllers: ON");
            Serial.println("[STATE] Swing-up algorithm activated.");
            Serial.println("[STATE] Telemetry is now streaming to AWS at 10 Hz.\n");
        }

        static unsigned long last_tel = 0;
        if (is_publishing && (millis() - last_tel >= 100))
        {
            last_tel = millis();
            StaticJsonDocument<256> tdoc;

            // MATCHING REACT VARIABLES
            tdoc["a1"] = a1;
            tdoc["a2"] = a2;
            tdoc["v1"] = v1;
            tdoc["v2"] = v2;
            tdoc["u"] = u;

            char buf[256];
            serializeJson(tdoc, buf);

            // MATCHING REACT TOPIC
            if (client.publish("rotary/telemetry", buf))
            {
                Serial.printf("[TELEMETRY] Sent -> a1: %6.2f | a2: %6.2f | u: %6.2f\n", a1, a2, u);
            }
            else
            {
                Serial.println("[ERROR] ESP32 failed to publish to AWS! Buffer might be full.");
            }
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
#endif

/* Type guards for S-Function Builder */
#ifndef real32_T
typedef float real32_T;
#endif
#ifndef boolean_T
typedef unsigned char boolean_T;
#endif
/* Includes_END */

/* Externs_BEGIN */
/* extern double func(double a); */
/* Externs_END */

void cloud_mqtt_Start_wrapper(void)
{
/* Start_BEGIN */
#ifndef MATLAB_MEX_FILE
    xTaskCreatePinnedToCore(CloudTask, "CloudTask", 8192, NULL, 1, NULL, 1);
#endif
    /* Start_END */
}

void cloud_mqtt_Outputs_wrapper(const real32_T *a1_in,
                                const real32_T *a2_in,
                                const real32_T *v1_in,
                                const real32_T *v2_in,
                                const real32_T *u_in,
                                real32_T *K_out,
                                boolean_T *enable_control)
{
/* Output_BEGIN */
#ifndef MATLAB_MEX_FILE
    portENTER_CRITICAL(&g_mqttMux);

    // Read physical sensors
    g_sim_a1 = a1_in[0];
    g_sim_a2 = a2_in[0];
    g_sim_v1 = v1_in[0];
    g_sim_v2 = v2_in[0];
    g_sim_u = u_in[0];

    // Output K matrix
    K_out[0] = g_cloud_K[0];
    K_out[1] = g_cloud_K[1];
    K_out[2] = g_cloud_K[2];
    K_out[3] = g_cloud_K[3];

    // State Machine Output to Simulink
    enable_control[0] = g_control_active;

    portEXIT_CRITICAL(&g_mqttMux);
#else
    K_out[0] = 0;
    K_out[1] = 0;
    K_out[2] = 0;
    K_out[3] = 0;
    enable_control[0] = 0;
#endif
    /* Output_END */
}

void cloud_mqtt_Terminate_wrapper(void)
{
    /* Terminate_BEGIN */
    /*
     * Custom Terminate code goes here.
     */
    /* Terminate_END */
}