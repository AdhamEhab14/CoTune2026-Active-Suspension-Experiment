
/*
 * Include Files
 *
 */
#if defined(MATLAB_MEX_FILE)
#include "tmwtypes.h"
#include "simstruc_types.h"
#else
#define SIMPLIFIED_RTWTYPES_COMPATIBILITY
#include "rtwtypes.h"
#undef SIMPLIFIED_RTWTYPES_COMPATIBILITY
#endif



/* %%%-SFUNWIZ_wrapper_includes_Changes_BEGIN --- EDIT HERE TO _END */
#include <math.h>

#ifndef MATLAB_MEX_FILE
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "D:\CoTune2026\Active_Suspension_resources\Parameter_Estimation_DAQ\Final\secrets.h"

extern "C" void arduino_esp_crt_bundle_attach(void *conf) {}


static WiFiClientSecure net;
static PubSubClient client(net);

// Data
static float g_cloud_K[4] = {0,0,0,0};
static float g_cloud_amp = 0.0f;
static float g_cloud_freq = 0.0f;

// 3-Phase State Logic Variables
static bool g_system_active = false; 
static bool g_road_active = false;   
static bool g_lqr_active = false;    
static unsigned long g_start_time = 0;

static float g_sim_d1 = 0, g_sim_d2 = 0, g_sim_vs = 0, g_sim_vus = 0, g_sim_u = 0;

static portMUX_TYPE g_mqttMux = portMUX_INITIALIZER_UNLOCKED;

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload, length)) {
        Serial.println("[ERROR] Failed to parse incoming JSON!");
        return;
    }
    
    const char* cmd = doc["command"];
    if (!cmd) return; // Prevent Null Pointer Dereference

    // Flags to trigger prints safely OUTSIDE the critical section
    bool print_start = false;
    bool print_stop = false;

    portENTER_CRITICAL(&g_mqttMux);
    if (strcmp(cmd, "START") == 0) {
        g_cloud_K[0] = doc["K"][0]; g_cloud_K[1] = doc["K"][1];
        g_cloud_K[2] = doc["K"][2]; g_cloud_K[3] = doc["K"][3];
        g_cloud_amp = doc["amp"];
        g_cloud_freq = doc["freq"];
        
        g_system_active = true;
        g_road_active = false;
        g_lqr_active = false;
        g_start_time = millis();
        print_start = true;
    } else if (strcmp(cmd, "STOP") == 0) {
        g_system_active = false;
        g_road_active = false;
        g_lqr_active = false;
        print_stop = true;
    }
    portEXIT_CRITICAL(&g_mqttMux);

    // --- SAFE TO PRINT DOWN HERE ---
    if (print_start) {
        Serial.println("\n=================================");
        Serial.println("   --- NEW EXPERIMENT STARTED ---");
        Serial.println("=================================");
        Serial.printf("[AWS DATA] Amp: %.2f | Freq: %.2f\n", doc["amp"].as<float>(), doc["freq"].as<float>());
        Serial.printf("[AWS DATA] K-Matrix: [%.2f, %.2f, %.2f, %.2f]\n", 
                      doc["K"][0].as<float>(), doc["K"][1].as<float>(), doc["K"][2].as<float>(), doc["K"][3].as<float>());
        Serial.println("\n[STATE] Phase 1: Telemetry active.");
        Serial.println("[STATE] Simulink status -> Road: OFF | LQR: OFF");
        Serial.println("[STATE] Waiting 10 seconds...\n");
    }
    if (print_stop) {
        Serial.println("\n[COMMAND] STOP received. System halted.");
        Serial.println("[STATE] Simulink status -> Road: OFF | LQR: OFF\n");
    }
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
        Serial.println("\n[ERROR] WiFi Failed! Restarting...");
        ESP.restart();
    }
    Serial.println("\n[NETWORK] WiFi Connected!");

    while(1) {
        if (!client.connected()) {
            Serial.println("[NETWORK] Attempting MQTT Connection...");
            if (client.connect("ESP32_Suspension")) {
                client.subscribe("SUSP/Parameters");
                Serial.println("[NETWORK] MQTT Connected to SUSP/Parameters!");
            } else {
                Serial.print("[ERROR] MQTT Connection Failed. State: ");
                Serial.println(client.state());
                Serial.println("Retrying in 1s...");
                vTaskDelay(pdMS_TO_TICKS(1000));
            }
        }
        client.loop();

        bool print_phase2 = false;
        bool print_phase3 = false;
        bool is_publishing = false; // <--- NEW: Master switch for cloud telemetry

        portENTER_CRITICAL(&g_mqttMux);
        if (g_system_active) {
            unsigned long elapsed = millis() - g_start_time;
            
            // <--- NEW: Only unlock telemetry AFTER the first 10 seconds
            if (elapsed >= 10000) {
                is_publishing = true; 
            }
            
            // Trigger Phase 2 (10s to 20s)
            if (elapsed >= 10000 && elapsed < 20000 && !g_road_active) {
                g_road_active = true;
                print_phase2 = true;
            }
            // Trigger Phase 3 (20s+)
            else if (elapsed >= 20000 && !g_lqr_active) {
                g_lqr_active = true;
                print_phase3 = true;
            }
        }
        
        float d1 = g_sim_d1, d2 = g_sim_d2, vs = g_sim_vs, vus = g_sim_vus, u = g_sim_u;
        portEXIT_CRITICAL(&g_mqttMux);

        // --- SAFE TO PRINT DOWN HERE ---
        if (print_phase2) {
            Serial.println("\n[STATE] *** Phase 2 Engaged ***");
            Serial.println("[STATE] Simulink status -> Road: ON | LQR: OFF");
            Serial.println("[STATE] Telemetry is now streaming to AWS at 10 Hz.\n");
        }
        if (print_phase3) {
            Serial.println("\n[STATE] *** Phase 3 Engaged ***");
            Serial.println("[STATE] Simulink status -> Road: ON | LQR: ON");
            Serial.println("[STATE] Controller is now fighting the vibration.\n");
        }

        static unsigned long last_tel = 0;
        if (is_publishing && (millis() - last_tel >= 100)) {
            last_tel = millis();
            StaticJsonDocument<256> tdoc;
            tdoc["d1"] = d1; tdoc["d2"] = d2;
            tdoc["vs"] = vs; tdoc["vus"] = vus; tdoc["u"] = u;
            char buf[256];
            serializeJson(tdoc, buf);
            
            if (client.publish("suspension/telemetry", buf)) {
                // We are turning this back on! 115200 baud is fast enough to handle 10 Hz without crashing.
                Serial.printf("[TELEMETRY] Sent -> d1: %6.2f | vs: %6.2f | u: %6.2f\n", d1, vs, u);
            } else {
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
/* %%%-SFUNWIZ_wrapper_includes_Changes_END --- EDIT HERE TO _BEGIN */
#define u_width 1
#define u_1_width 1
#define u_2_width 1
#define u_3_width 1
#define u_4_width 1
#define y_width 4
#define y_1_width 1
#define y_2_width 1
#define y_3_width 1
#define y_4_width 1

/*
 * Create external references here.  
 *
 */
/* %%%-SFUNWIZ_wrapper_externs_Changes_BEGIN --- EDIT HERE TO _END */
/* extern double func(double a); */
/* %%%-SFUNWIZ_wrapper_externs_Changes_END --- EDIT HERE TO _BEGIN */

/*
 * Start function
 *
 */
extern "C" void Cloud_MQTT_Start_wrapper(void);

void Cloud_MQTT_Start_wrapper(void)
{
/* %%%-SFUNWIZ_wrapper_Start_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  xTaskCreatePinnedToCore(CloudTask, "CloudTask", 8192, NULL, 1, NULL, 1);
#endif
/* %%%-SFUNWIZ_wrapper_Start_Changes_END --- EDIT HERE TO _BEGIN */
}
/*
 * Output function
 *
 */
extern "C" void Cloud_MQTT_Outputs_wrapper(const real32_T *d1_in,
			const real32_T *d2_in,
			const real32_T *vs_in,
			const real32_T *vus_in,
			const real32_T *u_in,
			real32_T *K_out,
			real32_T *amp_out,
			real32_T *freq_out,
			boolean_T *enable_lqr,
			boolean_T *exp_running);

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
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_BEGIN --- EDIT HERE TO _END */
#ifndef MATLAB_MEX_FILE
  portENTER_CRITICAL(&g_mqttMux);
  
  // Reading from the physical sensors/Kalman Filter now!
  g_sim_d1 = d1_in[0];
  g_sim_d2 = d2_in[0];
  g_sim_vs = vs_in[0];
  g_sim_vus = vus_in[0];
  g_sim_u = u_in[0];

  K_out[0] = g_cloud_K[0];
  K_out[1] = g_cloud_K[1];
  K_out[2] = g_cloud_K[2];
  K_out[3] = g_cloud_K[3];
  amp_out[0] = g_cloud_amp;
  freq_out[0] = g_cloud_freq;
  
  // State Machine Outputs to Simulink
  enable_lqr[0] = g_lqr_active;   // Triggers your LQR feedback loop
  exp_running[0] = g_road_active; // Triggers your Road Excitation logic
  
  portEXIT_CRITICAL(&g_mqttMux);
#else
  K_out[0] = 0; K_out[1] = 0; K_out[2] = 0; K_out[3] = 0;
  amp_out[0] = 0; freq_out[0] = 0;
  enable_lqr[0] = 0;
  exp_running[0] = 0;
#endif
/* %%%-SFUNWIZ_wrapper_Outputs_Changes_END --- EDIT HERE TO _BEGIN */
}


