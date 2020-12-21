const SPOTIFY_AD_TITLE = "Advertisement ·";

const titleIsAd = (title) => {
	const adRegex = new RegExp(`^${SPOTIFY_AD_TITLE}`);
	return !!title.match(adRegex);
};

const mute = (tabId) => {
	chrome.tabs.update(tabId, { muted: true });
};

const unmute = (tabId) => {
	chrome.tabs.update(tabId, { muted: false });
};

const checkForAd = (tabId, _changeInfo, tab) => {
	console.log(tab);
	if (titleIsAd(tab.title)) {
		console.log("Ad detected");
		if (!tab.mutedInfo.muted) {
			mute(tabId);
		}
	} else {
		if (tab.mutedInfo.muted) {
			unmute(tabId);
		}
	}
};

const run = () => {
	chrome.tabs.onUpdated.addListener(checkForAd);
};

run();
