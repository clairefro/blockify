const SPOTIFY_URL = "open.spotify.com/";
const SPOTIFY_AD_TITLE_START = "Spotify –";

const random = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

chrome.runtime.onStartup.addListener(() => {
  console.log("Extension starting up, preloading offscreen document");
  fillerMusic.ensureOffscreenDocumentCreated();
});

// Also preload when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, preloading offscreen document");
  fillerMusic.ensureOffscreenDocumentCreated();
});

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

        // Wait for document to be ready with shorter timeout
        this.offscreenReady = false;
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn(
              "Timed out waiting for offscreen document, assuming ready"
            );
            this.offscreenReady = true;
            resolve();
          }, 2000); // Reduced timeout to 2 seconds

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
      // Try to ensure document is created but don't wait too long
      const documentPromise = this.ensureOffscreenDocumentCreated();

      // Only wait up to 1 second for document creation
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(resolve, 1000)
      );
      await Promise.race([documentPromise, timeoutPromise]);

      // Proceed with playback regardless
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
      this.currentlyPlaying = true;
      return false;
    }
  }

  async stop(force = false) {
    console.log(
      "Stop requested, currently playing:",
      this.currentlyPlaying,
      "force:",
      force
    );

    // Always attempt to stop if force=true, regardless of currentlyPlaying flag
    if (this.currentlyPlaying || force) {
      console.log("Stopping filler music...");
      try {
        // Try to send stop message first to any existing offscreen document
        try {
          const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ["OFFSCREEN_DOCUMENT"],
          });

          if (existingContexts.length > 0) {
            await chrome.runtime.sendMessage({ action: "stop" });
            console.log("Stop message sent to offscreen document");
          } else {
            console.log("No offscreen document exists, skipping stop message");
          }
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
        this.currentlyPlaying = false; // Reset state anyway
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

// Unified message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);

  if (message.action === "offscreenReady") {
    console.log("Offscreen document is ready");
    fillerMusic.offscreenReady = true;
    return false;
  }

  if (message.action === "getStatus") {
    // Check existing offscreen contexts to verify if music is actually playing
    chrome.runtime
      .getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
      })
      .then((contexts) => {
        const hasOffscreen = contexts.length > 0;
        // Only report as playing if we both believe it's playing AND have an offscreen document
        const isActuallyPlaying = fillerMusic.currentlyPlaying && hasOffscreen;
        sendResponse({
          isPlaying: isActuallyPlaying,
          hasOffscreen: hasOffscreen,
        });
      })
      .catch((err) => {
        console.error("Error checking contexts:", err);
        // Fall back to the stored state
        sendResponse({ isPlaying: fillerMusic.currentlyPlaying });
      });
    return true; // Keep channel open for async response
  }

  if (message.action === "manualStop") {
    console.log("Manual stop requested");
    // Force stop, regardless of current state
    fillerMusic
      .stop(true)
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
      await new Promise((resolve) => setTimeout(resolve, 800)); // Even longer delay

      if (tab.mutedInfo.muted) {
        console.log("Unmuting tab");
        unmute(tabId);
      }
    }
  }
};

// Add tab listener
chrome.tabs.onUpdated.addListener(checkForAd);
