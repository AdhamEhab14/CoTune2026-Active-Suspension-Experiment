import React, { useState, useEffect } from "react";

const LiveVideoPlayer2 = () => {
  const youtubeChannelId = "UCmIGNbu1899QSh9W6hGhvJg"; // Replace with your YouTube channel ID
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setReloadKey((prev) => prev + 1);
    }, 15000); // 15 seconds

    return () => clearTimeout(timer); // Cleanup if component unmounts
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="video-container">
      <h2 className="video-title">Live Video Stream</h2>
      <iframe
        key={reloadKey}
        src={`https://www.youtube.com/embed/live_stream?channel=${youtubeChannelId}&autoplay=1`}
        className="video-frame"
        allowFullScreen
        allow="autoplay; encrypted-media"
        title="YouTube Live Stream"
      ></iframe>

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
            height: 660px;
            border: none;
          }

          @media (max-width: 1024px) {
            .video-frame {
              height: 428px;
            }
          }

          @media (max-width: 768px) {
            .video-title {
              font-size: 18px;
            }
            .video-frame {
              height: 304px;
            }
          }

          @media (max-width: 480px) {
            .video-title {
              font-size: 16px;
            }
            .video-frame {
              height: 165px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default LiveVideoPlayer2;
