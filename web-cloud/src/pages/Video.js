import React from "react";

const LiveVideoPlayer = () => {
  const twitchChannel = "cotune26";
  const parentDomain = window.location.hostname; // Dynamically get parent domain

  return (
    <div className="video-container">
      <h2 className="video-title">Live Video Stream</h2>
      <iframe
        src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${parentDomain}`}
        className="video-frame"
        allowFullScreen
      ></iframe>

      {/* Responsive styles */}
      <style>
        {`
          .video-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 20px;
            width: 100%;
          }

          .video-title {
            font-size: 24px;
            text-align: center;
          }

          .video-frame {
            width: 100%;
            height: 600px;
            border: none;
          }

          @media (max-width: 1024px) {
            .video-frame {
              width: 100%;
              height: 428px;
            }
          }

          @media (max-width: 768px) {
            .video-title {
              font-size: 18px;
            }
            .video-frame {
              width: 100%;
              height: 304px;
            }
          }

          @media (max-width: 480px) {
            .video-title {
              font-size: 16px;
            }
            .video-frame {
              width: 100%;
              height: 165px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default LiveVideoPlayer;
