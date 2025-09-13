(() => {
	if (window.__learnCrackedInjected) {
		// Prevent running twice
		return;
	}
	window.__learnCrackedInjected = true;
	const logPrefix = '[LearnCracked]';

	const SELECTORS = [
		// Try most specific selector first
		'button[class*="SessionTimer__TimerButton"]',
		'button[class*="TimerButton"]',
		// Try SVG inside button if needed
		'button svg[class*="RoundProgress__SVG"]',
		'button svg.RoundProgress__SVG-sc-yodzo6-0'
	];

	let lastClickedUrl = null;
		let studySessionClicked = false; // Prevents multiple clicks within the study session

	function isVisible(el) {
		if (!el) return false;
		const style = window.getComputedStyle(el);
		if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') return false;
		const rect = el.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}

	function resolveToButton(node) {
		if (!node) return null;
		if (node.tagName === 'BUTTON') return node;
		return node.closest ? node.closest('button') : null;
	}

		function getRoot() {
			return document.querySelector('#react-learncoach-app') || document.body || document.documentElement;
		}

		function findTimerButton() {
			const root = getRoot();
			let candidates = [];
			for (const sel of SELECTORS) {
				const nodes = root.querySelectorAll(sel);
				nodes.forEach(n => {
					const btn = resolveToButton(n);
					if (!btn) return;
					if (!isVisible(btn)) return;
					candidates.push(btn);
				});
			}
			// Remove duplicates
			candidates = Array.from(new Set(candidates));
			if (candidates.length === 0) return null;
			// Prefer buttons with key class names
			const scored = candidates.map(btn => {
				const cls = btn.className || '';
				let score = 0;
				if (typeof cls === 'string') {
					if (cls.includes('SessionTimer__TimerButton')) score += 5;
					if (cls.includes('TimerButton')) score += 2;
				}
				// Prefer buttons with SVG child
				if (btn.querySelector('svg[class*="RoundProgress__SVG"], svg.RoundProgress__SVG-sc-yodzo6-0')) score += 3;
				// Prefer enabled buttons
				if (!btn.disabled) score += 1;
				return { btn, score };
			});
			scored.sort((a, b) => b.score - a.score);
			return scored[0].btn;
		}

		function emulateUserClick(btn) {
			const rect = btn.getBoundingClientRect();
			const x = rect.left + rect.width / 2;
			const y = rect.top + rect.height / 2;
			const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window };
			try { btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', ...opts })); } catch {}
			try { btn.dispatchEvent(new MouseEvent('mousedown', opts)); } catch {}
			try { btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', ...opts })); } catch {}
			try { btn.dispatchEvent(new MouseEvent('mouseup', opts)); } catch {}
			try { btn.dispatchEvent(new MouseEvent('click', opts)); } catch {}
		}

			function removePauseModal(reason) {
				const selectorList = [
					'[data-testid="modal-background"]',
					// Fallbacks by class tokens
					'.RoundedModal__Background-sc-1y52xgn-0',
					'.Components__ModalBackground-sc-1mtph08-0',
					'.modal-inner',
				];

				function findModal() {
					for (const sel of selectorList) {
						const el = document.querySelector(sel);
						if (el) return el;
					}
					return null;
				}

				const existing = findModal();
				if (existing) {
					console.log(logPrefix, 'Remove pause modal', reason);
					existing.remove();
					return true;
				}

				console.log(logPrefix, 'Waiting for pause modal', reason);
				const started = Date.now();
				const maxMs = 15000;
				const observer = new MutationObserver(() => {
					const modal = findModal();
					if (modal) {
						console.log(logPrefix, 'Remove pause modal when it shows', reason);
						modal.remove();
						observer.disconnect();
					} else if (Date.now() - started > maxMs) {
						observer.disconnect();
						console.log(logPrefix, 'Stop watching for modal', reason);
					}
				});
				observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
				setTimeout(() => observer.disconnect(), maxMs + 500);
				return false;
			}

			function clickButton(btn, reason) {
		try {
					console.log(logPrefix, 'Click timer button', reason);
				// Try native click first
				btn.click();
				// Also simulate full mouse interaction for frameworks listening to down/up
				emulateUserClick(btn);
			lastClickedUrl = location.href;
					// Attempt to remove any session pause modal right after clicking
					removePauseModal('post-click');
			return true;
		} catch (e) {
			console.warn(logPrefix, 'Click failed', e);
			return false;
		}
	}

	function tryClick(reason) {
		// Avoid double-clicking on the same URL unless explicitly reset
			if (studySessionClicked) {
				return false;
			}
			if (lastClickedUrl === location.href) return false;
		const btn = findTimerButton();
		if (btn) {
				const ok = clickButton(btn, reason);
				if (ok) {
					studySessionClicked = true;
				}
				return ok;
		}
		return false;
	}

			function observeForButton(maxMs = 30000, reason = 'observer') {
				console.log(logPrefix, 'Watch for timer button', reason);
		const started = Date.now();
			if (tryClick(`${reason}:immediate`)) return;

		const observer = new MutationObserver(() => {
			if (Date.now() - started > maxMs) {
				observer.disconnect();
				return;
			}
			if (tryClick(`${reason}:mutation`)) {
				observer.disconnect();
			}
		});
		observer.observe(document.documentElement || document.body, {
			childList: true,
			subtree: true
		});

			// Timeout to stop observing
			setTimeout(() => {
				observer.disconnect();
				console.log(logPrefix, 'Stop watching for button', reason);
			}, maxMs + 1000);

				const interval = setInterval(() => {
				if (Date.now() - started > maxMs) {
					clearInterval(interval);
						console.log(logPrefix, 'Stop polling for button', reason);
					return;
				}
				if (tryClick(`${reason}:interval`)) {
					clearInterval(interval);
				}
			}, 1000);
	}

			function onRouteChange() {
				console.log(logPrefix, 'Route changed', location.href);
		// Reset per-URL click guard when route changes
		if (lastClickedUrl !== location.href) {
			lastClickedUrl = null;
		}
					if (location.pathname.includes('/study/')) {
						if (studySessionClicked) {
							console.log(logPrefix, 'Already clicked, skip');
							return;
						}
				observeForButton(30000, 'route-change');
			} else {
						console.log(logPrefix, 'Not study page, reset flag');
						studySessionClicked = false;
			}
	}

		function hookSpaNavigation() {
		const pushState = history.pushState;
		const replaceState = history.replaceState;

		function fireLocationChange() {
			window.dispatchEvent(new Event('locationchange'));
		}

		history.pushState = function () {
			const ret = pushState.apply(this, arguments);
			fireLocationChange();
			return ret;
		};
		history.replaceState = function () {
			const ret = replaceState.apply(this, arguments);
			fireLocationChange();
			return ret;
		};
		window.addEventListener('popstate', fireLocationChange);
		window.addEventListener('locationchange', onRouteChange);

			let lastHref = location.href;
			setInterval(() => {
				if (location.href !== lastHref) {
					lastHref = location.href;
					onRouteChange();
				}
			}, 300);
	}

		function init() {
		try {
			hookSpaNavigation();
				window.addEventListener('pageshow', () => console.log(logPrefix, 'Page show', location.href));
				window.addEventListener('load', () => console.log(logPrefix, 'Page load', location.href));
				window.addEventListener('visibilitychange', () => {
					if (!document.hidden && location.pathname.includes('/study/')) {
						console.log(logPrefix, 'Page visible, try again');
							if (!studySessionClicked) {
								observeForButton(10000, 'visible');
							}
					}
				});
				console.log(logPrefix, 'Script started', location.href);
				// Initial page load: only act on study pages
				if (location.pathname.includes('/study/')) {
						if (!studySessionClicked) {
							observeForButton(30000, 'start');
						} else {
							console.log(logPrefix, 'Already clicked, skip start');
						}
				} else {
					console.log(logPrefix, 'Not study page, wait for navigation');
				}
		} catch (e) {
			console.warn(logPrefix, 'Init error', e);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();