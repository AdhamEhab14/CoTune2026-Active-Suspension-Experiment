import React, { useState } from "react";
import "./interactive.css";
import { Helmet } from "react-helmet-async";
import { FaSearch } from "react-icons/fa";

const Interactive = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVideo, setSelectedVideo] = useState(null);

  const videos = [

    {
      title: "PID Controller Explained",
      embedUrl: "https://www.youtube.com/embed/UR0hOmjaHp0",
      imageUrl: "https://img.youtube.com/vi/UR0hOmjaHp0/0.jpg",
    },

    {
      title: "  Introduction to Machine Learning",
      embedUrl: "https://www.youtube.com/embed/GwIo3gDZCVQ",
      imageUrl: "https://img.youtube.com/vi/GwIo3gDZCVQ/0.jpg",
    },
    {
      title: "Parameter Estimation in MATLAB",
      embedUrl:
        "https://drive.google.com/file/d/13li9plh2lz8s4bs08IG4jdudmFIFkjtQ/preview",
      imageUrl: "https://img.youtube.com/vi/AUtfvXtz12Y/0.jpg",
    },
    {
      title: "Deep Learning Explained",
      embedUrl: "https://www.youtube.com/embed/aircAruvnKk",
      imageUrl: "https://img.youtube.com/vi/aircAruvnKk/0.jpg",
    },
    {
      title: "Neural Networks from Scratch",
      embedUrl: "https://www.youtube.com/embed/Ilg3gGewQ5U",
      imageUrl: "https://img.youtube.com/vi/Ilg3gGewQ5U/0.jpg",
    },

    {
      title: "Kalman Filter for Control Systems",
      embedUrl: "https://www.youtube.com/embed/mwn8xhgNpFY",
      imageUrl: "https://img.youtube.com/vi/mwn8xhgNpFY/0.jpg",
    },
    {
      title: "Introduction to Reinforcement Learning",
      embedUrl: "https://www.youtube.com/embed/JgvyzIkgxF0",
      imageUrl: "https://img.youtube.com/vi/JgvyzIkgxF0/0.jpg",
    },
    {
      title: "Quanser Suspension",
      embedUrl: "https://www.youtube.com/embed/NELQQgRyOjE",
      imageUrl: "https://img.youtube.com/vi/NELQQgRyOjE/0.jpg",
    },



  ];

  const filteredVideos = videos.filter((video) =>
    video.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <section >
    <div className="container">
      <Helmet>
        <title>Lessons</title>
      </Helmet>
      <header className="top-bar">
        <div className="search-bar-container">
          <input
            type="text"
            className="search-bar"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FaSearch className="search-icon" />
        </div>
      </header>
      {selectedVideo ? (
        <div className="video-player-container">
          <iframe
            src={selectedVideo}
            frameBorder="0"
            allowFullScreen
            className="video-player"
          ></iframe>
          <button onClick={() => setSelectedVideo(null)}>Back</button>
        </div>
      ) : (
        <div className="video-grid">
          {filteredVideos.map((video, index) => {
            const isYouTube = video.embedUrl.includes("youtube.com/embed/");

            return (
              <div
                key={index}
                className="video-card"
                onClick={() =>
                  window.open(
                    isYouTube
                      ? `https://www.youtube.com/watch?v=${
                          video.embedUrl.split("/embed/")[1]
                        }`
                      : video.embedUrl, // Open directly for non-YouTube links
                    "_blank"
                  )
                }
              >
                <img
                  src={video.imageUrl}
                  alt={video.title}
                  className="thumbnail"
                />
                <h2 className="video-title">{video.title}</h2>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </section>
  );
};

export default Interactive;
