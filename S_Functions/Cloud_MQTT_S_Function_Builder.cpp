/* Includes_BEGIN */
#include <math.h>

#ifndef MATLAB_MEX_FILE
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Linker Hack for ESP32 certificate bundle
extern "C" void arduino_esp_crt_bundle_attach(void *conf) {}

#include "secrets.h"  // MUST be in same folder or in include path

static WiFiClientSecure net;
static PubSubClient client(net);

// Data
static float g_cloud_K[4] = {0,0,0,0};
static float g_cloud_amp = 0.0f;
static float g_cloud_freq = 0.0f;
static bool g_exp_running = false;
static bool g_lqr_active = false;
static unsigned long g_start_time = 0;
static float g_sim_d1 = 0, g_sim_d2 = 0, g_sim_vs = 0, g_sim_vus = 0, g_sim_u = 0;

static portMUX_TYPE g_mqttMux = portMUX_INITIALIZER_UNLOCKED;

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length)) return;
    const char* cmd = doc["command"];

    portENTER_CRITICAL(&g_mqttMux);
    if (strcmp(cmd, "START") == 0) {
        g_cloud_K[0] = doc["K"][0]; g_cloud_K[1] = doc["K"][1];
        g_cloud_K[2] = doc["K"][2]; g_cloud_K[3] = doc["K"][3];
        g_cloud_amp  = doc["amp"];
        g_cloud_freq = doc["freq"];
        g_exp_running = true;
        g_lqr_active = false;     
        g_start_time = millis();  
        Serial.println("Command: START received.");
    } else if (strcmp(cmd, "STOP") == 0) {
        g_exp_running = false;
        g_lqr_active = false;
        Serial.println("Command: STOP received.");
    }
    portEXIT_CRITICAL(&g_mqttMux);
}

static void CloudTask(void *param) {
    Serial.begin(115200);
    delay(2000);
    Serial.println("\n--- Initializing Cloud Task ---");

    net.setCACert(AWS_CERT_CA);
    net.setCertificate(AWS_CERT_CRT);
    net.setPrivateKey(AWS_CERT_PRIVATE);
    client.setServer(AWS_IOT_ENDPOINT, 8883);
    client.setCallback(mqttCallback);

    WiFi.begin(SECRET_SSID, SECRET_PASS);
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) { 
        vTaskDelay(pdMS_TO_TICKS(1000)); 
        Serial.print(".");
        retries++;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nWiFi Failed! Restarting...");
        ESP.restart();
    }
    Serial.println("\nWiFi Connected!");

    while(1) {
        if (!client.connected()) {
            if (client.connect("ESP32_Suspension")) {
                client.subscribe("suspension/commands");
                Serial.println("MQTT Connected!");
            }
        }
        client.loop();

        portENTER_CRITICAL(&g_mqttMux);
        if (g_exp_running && !g_lqr_active && (millis() - g_start_time >= 10000)) {
            g_lqr_active = true; 
            Serial.println("LQR logic engaged.");
        }
        bool is_run = g_exp_running;
        float d1 = g_sim_d1, d2 = g_sim_d2, vs = g_sim_vs, vus = g_sim_vus, u = g_sim_u;
        portEXIT_CRITICAL(&g_mqttMux);

        static unsigned long last_tel = 0;
        if (is_run && (millis() - last_tel >= 1000)) {
            last_tel = millis();
            StaticJsonDocument<256> tdoc;
            tdoc["d1"] = d1; tdoc["d2"] = d2;
            tdoc["vs"] = vs; tdoc["vus"] = vus; tdoc["u"] = u;
            char buf[256];
            serializeJson(tdoc, buf);
            client.publish("suspension/telemetry", buf);
            Serial.println("Telemetry Published");
        }
        vTaskDelay(pdMS_TO_TICKS(100)); 
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

void Cloud_MQTT_Start_wrapper(void)
{
/* Start_BEGIN */
#ifndef MATLAB_MEX_FILE
  xTaskCreatePinnedToCore(CloudTask, "CloudTask", 8192, NULL, 1, NULL, 1);
#endif
/* Start_END */
}

void Cloud_MQTT_Outputs_wrapper(const real32_T *d1_in,
                                const real32_T *d2_in,
                                const real32_T *vs_in,
                                const real32_T *vus_in,
                                const real32_T *u_in,
                                real32_T *K_out,
                                real32_T *amp_out,
                                real32_T *freq_out,
                                boolean_T *enable_lqr,
                                boolean_T *exp_running)
{
/* Output_BEGIN */
#ifndef MATLAB_MEX_FILE
  portENTER_CRITICAL(&g_mqttMux);
  
  g_sim_d1  = d1_in[0];
  g_sim_d2  = d2_in[0];
  g_sim_vs  = vs_in[0];
  g_sim_vus = vus_in[0];
  g_sim_u   = u_in[0];

  K_out[0] = g_cloud_K[0];
  K_out[1] = g_cloud_K[1];
  K_out[2] = g_cloud_K[2];
  K_out[3] = g_cloud_K[3];
  
  amp_out[0]  = g_cloud_amp;
  freq_out[0] = g_cloud_freq;
  
  enable_lqr[0] = g_lqr_active; 
  exp_running[0] = g_exp_running; 
  
  portEXIT_CRITICAL(&g_mqttMux);
#else
  K_out[0] = 0; K_out[1] = 0; K_out[2] = 0; K_out[3] = 0;
  amp_out[0] = 0; freq_out[0] = 0; 
  enable_lqr[0] = 0; 
  exp_running[0] = 0;
#endif
/* Output_END */
}

void Cloud_MQTT_Terminate_wrapper(void)
{
/* Terminate_BEGIN */
/*
 * Custom Terminate code goes here.
*/
/* Terminate_END */
}