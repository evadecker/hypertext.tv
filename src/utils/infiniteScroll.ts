interface InfiniteScrollOptions {
  /**
   * The speed of the scroll in pixels per second.
   * @default 40
   */
  scrollSpeed?: number | null;

  /**
   * The element to clone the content into.
   * If not provided, the content will be cloned into the container.
   */
  cloneInto?: HTMLElement;
}

export function infiniteScrollLoop(
  container: HTMLElement,
  content: HTMLElement,
  options: InfiniteScrollOptions = {},
) {
  const { scrollSpeed = 40, cloneInto } = options;

  const target = cloneInto || container;

  if (!container || !content || !target) return;

  const cloned = content.cloneNode(true);
  target.appendChild(cloned);

  const threshold = Math.floor(container.clientHeight * 0.1);
  const mobileSlowdownFactor = 0.6;

  const handleScroll = () => {
    const contentHeight = content.clientHeight;

    if (container.scrollTop > contentHeight + threshold) {
      container.scrollTo(0, container.scrollTop - contentHeight);
    } else if (container.scrollTop < threshold) {
      container.scrollTo(0, contentHeight + container.scrollTop);
    }
  };

  container.addEventListener("scroll", handleScroll, { passive: true });

  if (scrollSpeed) {
    let lastTime = performance.now();
    let totalScrolled = 0;
    let isPaused = false;

    const handleTouchStart = () => {
      isPaused = true;
    };

    const handleTouchEnd = () => {
      isPaused = false;
      lastTime = performance.now(); // Reset time to prevent jump
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    // Detect if the device is mobile
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );

    function animate(currentTime: number) {
      if (!scrollSpeed) return;
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (!isPaused) {
        // Apply mobile slowdown factor if on a mobile device
        const effectiveScrollSpeed = isMobile
          ? scrollSpeed * mobileSlowdownFactor
          : scrollSpeed;
        const targetScrollPerSecond = effectiveScrollSpeed;
        const scrollAmount = (targetScrollPerSecond * deltaTime) / 1000;
        
        // Accumulate fractional pixels
        totalScrolled += scrollAmount;
        
        // Only apply scroll when we have at least 1 pixel to scroll
        if (totalScrolled >= 1) {
          const pixelsToScroll = Math.floor(totalScrolled);
          container.scrollBy(0, pixelsToScroll);
          totalScrolled -= pixelsToScroll;
        }
      }

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }
}
