const SPOTIFY_URL = "open.spotify.com/";
const SPOTIFY_AD_TITLE_START = "Spotify –";

const random = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

class MusicPlayer {
  constructor() {
    this.currentlyPlaying = false;
    this.offscreenReady = false;
  }

  audioUrls = [
    "music/ThinkingFree.mp3",
    "music/RockHopping.mp3",
    "music/Cheeky.mp3",
    "music/HereForYears.mp3",
    "music/lofi-study.mp3",
  ];

  async ensureOffscreenDocumentCreated() {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });

      if (existingContexts.length === 0) {
        console.log("Creating new offscreen document");

        // Create document
        await chrome.offscreen.createDocument({
          url: "offscreen.html",
          reasons: ["AUDIO_PLAYBACK"],
          justification: "Playing filler music in place of jarring noise",
        });

        // Wait for document to be ready with improved logic
        this.offscreenReady = false;
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(
              "Timed out waiting for offscreen document, assuming ready"
            );
            this.offscreenReady = true;
            resolve();
          }, 5000); // Longer timeout

          const messageListener = (message) => {
            if (message.action === "offscreenReady") {
              console.log("Received ready message from offscreen document");
              this.offscreenReady = true;
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(messageListener);
              resolve();
            }
          };

          chrome.runtime.onMessage.addListener(messageListener);
        });

        console.log("Offscreen document ready state:", this.offscreenReady);
      } else {
        console.log("Offscreen document already exists");
        this.offscreenReady = true;
      }

      return true;
    } catch (e) {
      console.error("Error creating offscreen document:", e);
      // Assume ready even after error to prevent blocking
      this.offscreenReady = true;
      return false;
    }
  }

  async playRandom() {
    try {
      await this.ensureOffscreenDocumentCreated();

      // Even if not ready, try to play audio anyway
      const audioPath = chrome.runtime.getURL(random(this.audioUrls));
      console.log("Playing random audio:", audioPath);

      await chrome.runtime.sendMessage({
        action: "play",
        audioPath,
      });

      this.currentlyPlaying = true;
      return true;
    } catch (e) {
      console.error("Error playing audio:", e);
      // Still mark as playing since audio might be playing
      this.currentlyPlaying = true;
      return false;
    }
  }

  async stop() {
    if (this.currentlyPlaying) {
      console.log("Stopping filler music...");
      try {
        // Try to send stop message first
        try {
          await chrome.runtime.sendMessage({ action: "stop" });
        } catch (e) {
          console.warn("Could not send stop message, will force close:", e);
        }

        // Force close the document
        await this.forceCloseOffscreenDocument();
        this.currentlyPlaying = false;
        console.log("Filler music stopped");
        return true;
      } catch (e) {
        console.error("Error stopping music:", e);
        this.currentlyPlaying = false;
        return false;
      }
    }
    return true;
  }

  async forceCloseOffscreenDocument() {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      });

      if (existingContexts.length > 0) {
        await chrome.offscreen.closeDocument();
        console.log("Offscreen document closed");
      }

      this.offscreenReady = false;
      return true;
    } catch (e) {
      console.error("Error closing offscreen document:", e);
      this.offscreenReady = false;
      return false;
    }
  }
}

const fillerMusic = new MusicPlayer();

// SINGLE unified message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "offscreenReady") {
    console.log("Offscreen document is ready");
    fillerMusic.offscreenReady = true;
    return false;
  }

  if (message.action === "getStatus") {
    sendResponse({ isPlaying: fillerMusic.currentlyPlaying });
    return false;
  }

  if (message.action === "manualStop") {
    fillerMusic
      .stop()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error during manual stop:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  return false;
});

const titleIsAd = (title) => {
  const adRegex = new RegExp(`^${SPOTIFY_AD_TITLE_START}`);
  return !!title.match(adRegex);
};

const mute = (tabId) => {
  chrome.tabs.update(tabId, { muted: true });
};

const unmute = (tabId) => {
  chrome.tabs.update(tabId, { muted: false });
};

const checkForAd = async (tabId, _changeInfo, tab) => {
  // only process if this is a Spotify tab with a valid URL and title
  if (tab.url && tab.url.includes(SPOTIFY_URL) && tab.title) {
    console.log(`Title changed: ${tab.title}, is ad: ${titleIsAd(tab.title)}`);

    if (titleIsAd(tab.title)) {
      if (!tab.mutedInfo.muted) {
        console.log("Ad detected, muting and playing filler music");
        mute(tabId);
        await fillerMusic.playRandom();
      }
    } else {
      console.log("Not an ad, stopping filler music");
      // Always stop music first
      const stopped = await fillerMusic.stop();
      console.log("Stop result:", stopped);

      // Add a longer delay to ensure audio has completely stopped
      await new Promise((resolve) => setTimeout(resolve, 500)); // Increased delay

      if (tab.mutedInfo.muted) {
        console.log("Unmuting tab");
        unmute(tabId);
      }
    }
  }
};

// Add tab listener
chrome.tabs.onUpdated.addListener(checkForAd);
