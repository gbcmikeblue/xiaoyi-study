/**
 * 整页固定后，滚动只发生在内容容器 .app-viewport 内。
 * 页面切换、步骤切换、换题时都需要把内容容器滚回顶部，
 * 否则新内容会接在上一次的滚动位置之后，导致按钮落在视口外。
 */
export function scrollAppToTop(smooth = false) {
  const viewport = document.querySelector('.app-viewport');
  if (!viewport) return;
  viewport.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}
