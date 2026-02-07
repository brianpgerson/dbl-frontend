import React from 'react';
import 'bsky-embed/dist/bsky-embed.es.js';
import './HomeRunVideos.css';

const HomeRunVideos = () => {
  return (
    <div className="home-run-videos">
      <h3>LATEST DONGS</h3>
      <div className="videos-container">
        <bsky-embed
          username="mlbhomeruns.bsky.social"
          mode="dark"
          limit="3"
          link-image="false"
          link-target="_blank"
          load-more="true"
          custom-styles={`
            /* Fix mobile right-side cutoff */
            .bsky-embed-container {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
            }
            .bsky-embed-feed {
              width: 100% !important;
              max-width: 100% !important;
            }
            .bsky-embed-post, .bsky-embed-post-content, .bsky-embed-post-images {
              width: 100% !important;
              max-width: 100% !important;
              word-break: break-word !important;
            }
            .bsky-embed-post-image img {
              max-width: 100% !important;
              height: auto !important;
            }
            
            /* Style "Load More Posts" button to match our theme */
            #bsky-load-more, .bsky-embed-load-more {
              background-color: #000 !important;
              color: #19b8ff !important;
              border: 2px solid #19b8ff !important;
              padding: 10px 20px !important;
              margin: 10px auto !important;
              font-family: 'Press Start 2P', cursive !important;
              font-size: 0.8rem !important;
              cursor: pointer !important;
              display: block !important;
              width: 80% !important;
              max-width: 300px !important;
              text-align: center !important;
              text-transform: uppercase !important;
              transition: all 0.2s ease !important;
              box-shadow: 0 0 10px rgba(25, 184, 255, 0.3) !important;
            }
            
            #bsky-load-more:hover, .bsky-embed-load-more:hover {
              background-color: rgba(25, 184, 255, 0.2) !important;
              box-shadow: 0 0 15px rgba(25, 184, 255, 0.5) !important;
              transform: scale(1.02) !important;
            }
            
            @media (max-width: 768px) {
              /* Hide profile pictures on mobile */
              .w-14.h-14.rounded-full, img.rounded-full {
                display: none !important;
              }
              
              /* Adjust spacing after removing profile pic */
              .bsky-embed-post-author {
                margin-left: 0 !important;
              }
              
              .bsky-embed-container, .bsky-embed-post, .bsky-embed-feed {
                padding-left: 5px !important;
                padding-right: 5px !important;
                box-sizing: border-box !important;
              }
              
              .bsky-embed-post-content {
                font-size: 0.8rem !important;
              }
              
              /* Smaller "Load More" button on mobile */
              #bsky-load-more, .bsky-embed-load-more {
                font-size: 0.6rem !important;
                padding: 8px 15px !important;
                margin: 5px auto !important;
              }
            }
          `}
        ></bsky-embed>
      </div>
      <div className="videos-credit">
        <a href="https://bsky.app/profile/mlbhomeruns.bsky.social" target="_blank" rel="noopener noreferrer">
          Videos from @mlbhomeruns.bsky.social
        </a>
      </div>
    </div>
  );
};

export default HomeRunVideos;