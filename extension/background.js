chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'hoard-save-page',
    title: 'Save Page to Hoard',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'hoard-save-link',
    title: 'Save Link to Hoard',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'hoard-save-image',
    title: 'Save Image to Hoard',
    contexts: ['image']
  });

  // Video context — saves the page URL (e.g. YouTube watch page)
  // Note: actual video stream URLs are DRM-protected and can't be downloaded
  chrome.contextMenus.create({
    id: 'hoard-save-video',
    title: 'Save Video Page to Hoard',
    contexts: ['video']
  });
});

async function sendToHoard(payload) {
  try {
    const response = await fetch('http://127.0.0.1:43210/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      // Show a brief success badge on the extension icon
      chrome.action?.setBadgeText({ text: '✓' });
      chrome.action?.setBadgeBackgroundColor({ color: '#c9952a' });
      setTimeout(() => chrome.action?.setBadgeText({ text: '' }), 2000);
    } else {
      console.error('Hoard server error:', response.statusText);
    }
  } catch (err) {
    console.error('Hoard is not running or unreachable:', err);
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'hoard-save-page') {
    await sendToHoard({
      type: 'link',
      url: info.pageUrl,
      title: tab?.title || info.pageUrl
    });

  } else if (info.menuItemId === 'hoard-save-link') {
    await sendToHoard({
      type: 'link',
      url: info.linkUrl,
      title: info.linkText || info.linkUrl
    });

  } else if (info.menuItemId === 'hoard-save-image') {
    await sendToHoard({
      type: 'image',
      srcUrl: info.srcUrl
    });

  } else if (info.menuItemId === 'hoard-save-video') {
    // For videos (YouTube, Vimeo, etc.) we save the PAGE URL, not the stream.
    // The stream is DRM-protected and changes every few seconds — it can't be captured.
    // Saving the page link lets you revisit the video any time.
    await sendToHoard({
      type: 'link',
      url: info.pageUrl,
      title: tab?.title || info.pageUrl
    });
  }
});
