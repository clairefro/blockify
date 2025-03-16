document.addEventListener("DOMContentLoaded", function () {
  const stopButton = document.getElementById("stopMusic");
  const statusText = document.getElementById("status");
  const statusDot = document.getElementById("statusDot");
  const statusLabel = document.getElementById("statusLabel");

  const STOP_FILLER_MUSIC_TEXT = "Stop Filler Music";

  function updateButtonState(isPlaying) {
    if (isPlaying) {
      stopButton.textContent = STOP_FILLER_MUSIC_TEXT;
      stopButton.disabled = false;
      statusDot.className = "status-dot active";
      statusLabel.textContent = "Playing filler music";
    } else {
      stopButton.textContent = "No Music Playing";
      stopButton.disabled = true;
      statusDot.className = "status-dot inactive";
      statusLabel.textContent = "Not playing filler music";
    }
  }

  // Always enable the stop button, even if we're not sure music is playing
  function enableStopButton() {
    stopButton.textContent = STOP_FILLER_MUSIC_TEXT;
    stopButton.disabled = false;
  }

  // Check current music status when popup opens
  chrome.runtime.sendMessage({ action: "getStatus" }, function (response) {
    console.log("Status response:", response);
    if (response) {
      updateButtonState(response.isPlaying);

      // Even if not reported as playing, enable the stop button if we have an offscreen document
      if (response.hasOffscreen) {
        enableStopButton();
      }
    }
  });

  stopButton.addEventListener("click", function () {
    statusText.textContent = "Stopping music...";
    stopButton.disabled = true;

    chrome.runtime.sendMessage({ action: "manualStop" }, function (response) {
      console.log("Stop response:", response);
      if (response && response.success) {
        statusText.textContent = "Music stopped successfully";
      } else {
        statusText.textContent = "Failed to stop music";
      }
      updateButtonState(false);
    });
  });
});
