'use strict';

// These 36 public slugs were recovered from generated-site commit 85d871f^ and
// were consolidated into the long-form research narratives on 2026-08-30.
const legacyRedirects = [
  ['NarrowGate-Active-Order-Lifecycle-CIF-100ms-Research', 'NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research'],
  ['NarrowGate-BER-Role-Safe-Add-Only-Research', 'NarrowGate-Ranked-Toxicity-Exposure-Guard-Research'],
  ['NarrowGate-Binance-Trade-Clock-Parity-Research', 'NarrowGate-Side-Taker-Flow-Research'],
  ['NarrowGate-Buy-Conditional-Widen-Research', 'NarrowGate-Fixed-Parameter-Racing-Research'],
  ['NarrowGate-Buy-Q90-Causal-Clock-Lifecycle-Research', 'NarrowGate-Ranked-Toxicity-Exposure-Guard-Research'],
  ['NarrowGate-Buy-Q90-Portfolio-Attribution-Research', 'NarrowGate-Ranked-Toxicity-Exposure-Guard-Research'],
  ['NarrowGate-Buy-Soft-Widen-Release-Action-Value-Research', 'NarrowGate-Decision-Visible-Negative-Fill-Value-Research'],
  ['NarrowGate-Causal-13-Head-Empirical-P3-v4-Research', 'NarrowGate-Causal-13-Head-Source-Aware-v12-Research'],
  ['NarrowGate-Causal-13-Head-Normalized-100ms-Revalidation-Research', 'NarrowGate-Causal-13-Head-Source-Aware-v12-Research'],
  ['NarrowGate-Causal-13-Head-One-Second-Cadence-Research', 'NarrowGate-Causal-13-Head-Source-Aware-v12-Research'],
  ['NarrowGate-Causal-13-Head-Taker-Tempo-v9-Research', 'NarrowGate-Causal-13-Head-Source-Aware-v12-Research'],
  ['NarrowGate-Conditional-P3-Joint-Quote-Value-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-Cross-Venue-Causal-Fair-Price-Research', 'NarrowGate-Three-Venue-Global-Reference-Stage0-Research'],
  ['NarrowGate-Cross-Venue-Fair-Center-Research', 'NarrowGate-Three-Venue-Global-Reference-Stage0-Research'],
  ['NarrowGate-Dynamic-Campaign-Mechanism-Attribution-Research', 'NarrowGate-Decision-Visible-Negative-Fill-Value-Research'],
  ['NarrowGate-Event-Identity-Riskset-Research', 'NarrowGate-Side-Taker-Flow-Research'],
  ['NarrowGate-External-Adverse-Quote-Edge-Guard-Research', 'NarrowGate-Three-Venue-Global-Reference-Stage0-Research'],
  ['NarrowGate-External-Information-Decay-Research', 'NarrowGate-Three-Venue-Global-Reference-Stage0-Research'],
  ['NarrowGate-Fill-Inventory-Lifecycle-Research', 'NarrowGate-Decision-Visible-Negative-Fill-Value-Research'],
  ['NarrowGate-First-Add-Decision-Terminal-Loss-Research', 'NarrowGate-Decision-Visible-Negative-Fill-Value-Research'],
  ['NarrowGate-First-Add-External-Incremental-Value-Research', 'NarrowGate-Three-Venue-Global-Reference-Stage0-Research'],
  ['NarrowGate-Fixed-Local-Quote-Actions-Research', 'NarrowGate-Fixed-Parameter-Racing-Research'],
  ['NarrowGate-Historical-Backtest-Evidence-Revalidation', 'NarrowGate-Time-Unit-Causality-Repair-Research'],
  ['NarrowGate-Multi-Short-Reducing-Buy-Research', 'NarrowGate-Sell-Add-Inventory-Price-Penalty-Research'],
  ['NarrowGate-P3-Conditional-Curve-Scalar-Quote-Adapter-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-P3-Normalized-100ms-Recalibration-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-P3-Policy-Visible-Decision-Cadence-Transport-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-P3-Source-Aware-Static-Touch-Curve-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-P3-Volatility-Conditioned-Touch-Surface-Research', 'NarrowGate-P3-Aggressive-Reach-Time-Hazard-Research'],
  ['NarrowGate-Placement-Distance-Fill-CIF-Marginal-Value-Research', 'NarrowGate-Active-Order-Queue-Value-Keep-Cancel-Research'],
  ['NarrowGate-Post-Cooldown-Inventory-Budget-Research', 'NarrowGate-Sell-Add-Inventory-Price-Penalty-Research'],
  ['NarrowGate-Recovery-Event-Rearm-Research', 'NarrowGate-Volatility-Time-Add-Rearm-Research'],
  ['NarrowGate-Sell-One-Cycle-Skip-Research', 'NarrowGate-Volatility-Time-Add-Rearm-Research'],
  ['NarrowGate-Sell-Stop-Add-Until-Flat-Research', 'NarrowGate-Volatility-Time-Add-Rearm-Research'],
  ['NarrowGate-Side-Taker-Hazard-M0-Research', 'NarrowGate-Side-Taker-Flow-Research'],
  ['NarrowGate-State-Conditioned-Rearm-Research', 'NarrowGate-Volatility-Time-Add-Rearm-Research']
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function migrationPage(siteUrl, targetPath) {
  const canonicalUrl = `${siteUrl}${targetPath}`;
  const safePath = escapeHtml(targetPath);
  const safeCanonical = escapeHtml(canonicalUrl);
  const scriptTarget = JSON.stringify(targetPath).replaceAll('<', '\\u003c');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <meta http-equiv="refresh" content="0; url=${safePath}">
  <link rel="canonical" href="${safeCanonical}">
  <title>文章已合并 · NarrowGate</title>
  <script>window.location.replace(${scriptTarget} + window.location.search + window.location.hash);</script>
</head>
<body>
  <main>
    <h1>文章已合并</h1>
    <p>这个历史研究页面已经合并进对应的 NarrowGate 主研究长文，以便在同一篇文章中保留完整问题、方法演进、反例、经济检验与权限边界。</p>
    <p>浏览器将自动跳转；如果没有跳转，请打开<a href="${safePath}">合并后的主研究文章</a>。</p>
  </main>
</body>
</html>`;
}

hexo.extend.generator.register('narrowgate-legacy-redirects', function generateLegacyRedirects() {
  const sourceSlugs = legacyRedirects.map(([sourceSlug]) => sourceSlug);
  if (legacyRedirects.length !== 36 || new Set(sourceSlugs).size !== legacyRedirects.length) {
    throw new Error('NarrowGate legacy redirect manifest must contain exactly 36 unique source slugs');
  }

  const siteUrl = String(hexo.config.url || 'https://xiao-nanbei.github.io').replace(/\/$/, '');
  return legacyRedirects.map(([sourceSlug, targetSlug]) => {
    const targetPath = `/2026/08/29/${targetSlug}/`;
    return {
      path: `2026/08/29/${sourceSlug}/index.html`,
      data: migrationPage(siteUrl, targetPath)
    };
  });
});
