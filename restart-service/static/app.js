/**
 * BewerbsBoard Host Power Control — Frontend Client Logic
 * Handles real-time telemetry polling, countdown timers, confirmation modals,
 * cancel requests, automatic host reconnection detection, and seamless static hosting demo fallback.
 */

(() => {
  'use strict';

  // Demo / Static Fallback Data
  const STATIC_DEMO_DATA = {
    status: 'online',
    host: {
      hostname: 'bewerbsboard-appliance',
      os_name: 'Ubuntu 24.04.1 LTS (Noble Numbat)',
      kernel: '6.8.0-45-generic',
      architecture: 'x86_64',
      python_version: '3.12.3',
    },
    uptime_seconds: 198420,
    service_uptime_seconds: 7320,
    cpu: {
      cores: 4,
      load_1m: 0.14,
      load_5m: 0.21,
      load_15m: 0.18,
    },
    memory: {
      total_bytes: 8589934592,
      available_bytes: 6442450944,
      used_bytes: 2147483648,
      used_percent: 25.0,
    },
    scheduled_action: null,
    dry_run: true,
    allow_cancel: true,
    server_time: Math.floor(Date.now() / 1000),
  };

  // State
  let currentHostData = null;
  let isStaticHostingMode = false;
  let simulatedActionTimer = null;
  let selectedRestartDelay = 5;
  let selectedShutdownDelay = 5;
  let pendingModalAction = null;
  let pendingModalDelay = 0;
  let countdownInterval = null;
  let pollInterval = null;
  let isReconnecting = false;
  let pingAttempts = 0;

  // DOM Elements
  const el = {
    pageTitle: document.getElementById('page-title'),
    hostSubtitle: document.getElementById('host-subtitle'),
    dryRunBadge: document.getElementById('dry-run-badge'),
    connectionBadge: document.getElementById('connection-badge'),
    connectionStatusText: document.getElementById('connection-status-text'),

    // Telemetry
    btnRefreshStats: document.getElementById('btn-refresh-stats'),
    statHostname: document.getElementById('stat-hostname'),
    statOs: document.getElementById('stat-os'),
    statKernel: document.getElementById('stat-kernel'),
    statUptime: document.getElementById('stat-uptime'),
    statCpu: document.getElementById('stat-cpu'),
    statMemText: document.getElementById('stat-mem-text'),
    statMemBar: document.getElementById('stat-mem-bar'),
    statPort: document.getElementById('stat-port'),
    footerServiceUptime: document.getElementById('footer-service-uptime'),

    // Action buttons & pills
    btnRestart: document.getElementById('btn-restart'),
    btnShutdown: document.getElementById('btn-shutdown'),
    restartDelayGroup: document.getElementById('restart-delay-group'),
    shutdownDelayGroup: document.getElementById('shutdown-delay-group'),

    // Active Banner
    activeBanner: document.getElementById('active-banner'),
    bannerTitle: document.getElementById('banner-title'),
    bannerDesc: document.getElementById('banner-desc'),
    bannerTimer: document.getElementById('banner-timer'),
    bannerIconContainer: document.getElementById('banner-icon-container'),
    btnCancelAction: document.getElementById('btn-cancel-action'),

    // Confirmation Modal
    confirmModal: document.getElementById('confirm-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalSubtitle: document.getElementById('modal-subtitle'),
    modalIconBadge: document.getElementById('modal-icon-badge'),
    modalHostnamePlaceholder: document.getElementById('modal-hostname-placeholder'),
    modalActionText: document.getElementById('modal-action-text'),
    modalDelayText: document.getElementById('modal-delay-text'),
    modalBtnCancel: document.getElementById('modal-btn-cancel'),
    modalBtnConfirm: document.getElementById('modal-btn-confirm'),

    // Reconnection Overlay
    reconnectOverlay: document.getElementById('reconnect-overlay'),
    reconnectTitle: document.getElementById('reconnect-title'),
    reconnectMessage: document.getElementById('reconnect-message'),
    reconnectStatus: document.getElementById('reconnect-status'),

    // Toasts
    toastContainer: document.getElementById('toast-container'),
  };

  // Utilities
  function formatSeconds(totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = iconSvg;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // Check if force demo mode is requested via URL
  const urlParams = new URLSearchParams(window.location.search);
  const forceDemo = urlParams.get('demo') === 'true' || window.location.protocol === 'file:';

  // Fetch & Update Telemetry
  async function fetchStatus() {
    if (forceDemo) {
      enableStaticDemoMode();
      return;
    }

    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      currentHostData = data;
      isStaticHostingMode = false;
      renderStatus(data);
      setConnected(true);
    } catch {
      // If running on a static host without backend, seamlessly activate demo mode
      if (!currentHostData || isStaticHostingMode) {
        enableStaticDemoMode();
      } else {
        setConnected(false);
      }
    }
  }

  function enableStaticDemoMode() {
    isStaticHostingMode = true;
    currentHostData = Object.assign({}, STATIC_DEMO_DATA, {
      server_time: Math.floor(Date.now() / 1000),
      scheduled_action: simulatedActionTimer,
    });
    renderStatus(currentHostData);
    el.connectionBadge.className = 'badge badge-warning';
    el.connectionStatusText.textContent = 'Static Demo Mode';
    el.dryRunBadge.classList.remove('hidden');
    el.dryRunBadge.innerHTML = '<span class="badge-dot"></span><span>Simulated</span>';
  }

  function setConnected(connected) {
    if (isStaticHostingMode) return;
    if (connected) {
      el.connectionBadge.className = 'badge badge-online';
      el.connectionStatusText.textContent = 'Connected';
    } else {
      el.connectionBadge.className = 'badge badge-warning';
      el.connectionStatusText.textContent = 'Offline / Reconnecting';
    }
  }

  function renderStatus(data) {
    // Header & Info
    const hostname = data.host?.hostname || 'Unknown';
    const osName = data.host?.os_name || 'Linux';
    el.hostSubtitle.textContent = `${hostname} • ${osName}`;
    el.statHostname.textContent = hostname;
    el.statOs.textContent = osName;
    el.statKernel.textContent = `${data.host?.kernel || '-'} (${data.host?.architecture || '-'})`;
    el.statUptime.textContent = formatSeconds(data.uptime_seconds);
    el.footerServiceUptime.textContent = `Daemon active: ${formatSeconds(data.service_uptime_seconds)}`;

    // Port display
    el.statPort.textContent = window.location.port || (window.location.protocol === 'https:' ? '443' : (window.location.protocol === 'file:' ? 'file' : '80'));

    // Dry Run Badge
    if (data.dry_run) {
      el.dryRunBadge.classList.remove('hidden');
    } else {
      el.dryRunBadge.classList.add('hidden');
    }

    // CPU Metrics
    if (data.cpu) {
      el.statCpu.textContent = `${data.cpu.cores} Cores • Load: ${data.cpu.load_1m}, ${data.cpu.load_5m}, ${data.cpu.load_15m}`;
    }

    // Memory Metrics
    if (data.memory && data.memory.total_bytes > 0) {
      const usedFormatted = formatBytes(data.memory.used_bytes);
      const totalFormatted = formatBytes(data.memory.total_bytes);
      const percent = data.memory.used_percent;
      el.statMemText.textContent = `${usedFormatted} / ${totalFormatted} (${percent}%)`;
      el.statMemBar.style.width = `${percent}%`;

      if (percent > 85) {
        el.statMemBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
      } else {
        el.statMemBar.style.background = 'linear-gradient(90deg, var(--color-brand), #818cf8)';
      }
    } else {
      el.statMemText.textContent = 'N/A';
      el.statMemBar.style.width = '0%';
    }

    // Scheduled Action Sync
    syncScheduledAction(data.scheduled_action);
  }

  function syncScheduledAction(actionData) {
    if (!actionData) {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
      el.activeBanner.classList.add('hidden');
      return;
    }

    el.activeBanner.classList.remove('hidden');
    const isRestart = actionData.action === 'restart';
    el.bannerTitle.textContent = isRestart ? 'Host Restart In Progress' : 'Host Shutdown In Progress';

    const executeAt = actionData.execute_at;

    function updateCountdown() {
      const now = Date.now() / 1000;
      const remaining = Math.max(0, executeAt - now);
      el.bannerTimer.textContent = remaining.toFixed(1);

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        el.bannerDesc.innerHTML = 'Action is executing now...';
        triggerReconnectionOverlay(actionData.action);
      } else {
        el.bannerDesc.innerHTML = `The host will ${actionData.action} in <strong id="banner-timer">${remaining.toFixed(1)}</strong> seconds.`;
      }
    }

    if (!countdownInterval) {
      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 100);
    }
  }

  // Delay Pill Selection
  function setupDelayPillGroup(groupEl, onSelect) {
    if (!groupEl) return;
    const pills = groupEl.querySelectorAll('.pill, .delay-pill');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => {
          p.classList.remove('active');
          p.setAttribute('aria-checked', 'false');
        });
        pill.classList.add('active');
        pill.setAttribute('aria-checked', 'true');
        const delay = parseInt(pill.dataset.delay, 10);
        onSelect(delay);
      });
    });
  }

  setupDelayPillGroup(el.restartDelayGroup, (val) => {
    selectedRestartDelay = val;
  });

  setupDelayPillGroup(el.shutdownDelayGroup, (val) => {
    selectedShutdownDelay = val;
  });

  // Modal Dialog Handlers
  function openConfirmModal(action, delay) {
    pendingModalAction = action;
    pendingModalDelay = delay;

    const isRestart = action === 'restart';
    const host = currentHostData?.host?.hostname || window.location.hostname || 'localhost';

    el.modalTitle.textContent = isRestart ? 'Confirm Host Restart' : 'Confirm Host Shutdown';
    el.modalSubtitle.textContent = isRestart
      ? 'This will reboot the system and restore scoreboard services.'
      : 'This will gracefully terminate processes and power off the host.';

    el.modalHostnamePlaceholder.textContent = host;
    el.modalActionText.textContent = action.toUpperCase();
    el.modalDelayText.textContent = delay === 0 ? 'Immediately (0 seconds)' : `${delay} seconds`;

    if (isRestart) {
      el.modalIconBadge.className = 'modal-badge';
      el.modalBtnConfirm.className = 'btn btn-restart';
      el.modalBtnConfirm.textContent = delay === 0 ? 'Restart Immediately' : `Schedule Restart (${delay}s)`;
    } else {
      el.modalIconBadge.className = 'modal-badge danger';
      el.modalBtnConfirm.className = 'btn btn-danger';
      el.modalBtnConfirm.textContent = delay === 0 ? 'Shutdown Immediately' : `Schedule Shutdown (${delay}s)`;
    }

    el.confirmModal.showModal();
    el.modalBtnCancel.focus();
  }

  function closeConfirmModal() {
    el.confirmModal.close();
    pendingModalAction = null;
  }

  // Action Triggers
  async function executeConfirmedAction() {
    const action = pendingModalAction;
    const delay = pendingModalDelay;
    closeConfirmModal();

    if (isStaticHostingMode) {
      showToast(`[Simulated] Scheduled ${action} in ${delay}s`, 'info');
      const executeAt = (Date.now() / 1000) + delay;
      simulatedActionTimer = { action, delay, execute_at: executeAt };
      if (delay === 0) {
        simulatedActionTimer = null;
        triggerReconnectionOverlay(action);
      } else {
        syncScheduledAction(simulatedActionTimer);
      }
      return;
    }

    const endpoint = action === 'restart' ? '/api/restart' : '/api/shutdown';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delay }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      showToast(`Action '${action}' scheduled (${delay}s delay)`, 'success');

      if (delay === 0 && !currentHostData?.dry_run) {
        triggerReconnectionOverlay(action);
      } else {
        fetchStatus();
      }
    } catch (err) {
      console.error(`Failed to trigger ${action}:`, err);
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  async function cancelScheduledAction() {
    if (isStaticHostingMode) {
      simulatedActionTimer = null;
      syncScheduledAction(null);
      showToast('Scheduled action aborted.', 'success');
      return;
    }

    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      if (result.success) {
        showToast(result.message || 'Scheduled action was cancelled.', 'success');
      } else {
        showToast(result.message || 'No action was running.', 'info');
      }

      fetchStatus();
    } catch (err) {
      console.error('Failed to cancel action:', err);
      showToast(`Failed to cancel: ${err.message}`, 'error');
    }
  }

  // Reconnection Detection
  function triggerReconnectionOverlay(action) {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isReconnecting = true;
    pingAttempts = 0;

    el.reconnectTitle.textContent = action === 'restart' ? 'Host is Restarting' : 'Host is Powering Down';
    el.reconnectMessage.textContent = action === 'restart'
      ? 'The host machine is rebooting. This view will automatically resume as soon as the service is back online.'
      : 'The machine is powering off. When restarted, this dashboard will automatically reconnect.';
    el.reconnectOverlay.classList.remove('hidden');

    if (isStaticHostingMode) {
      // Simulate reconnection in static preview mode
      const simTimer = setInterval(() => {
        pingAttempts++;
        el.reconnectStatus.textContent = `Simulating probe #${pingAttempts}...`;
        if (pingAttempts >= 3) {
          clearInterval(simTimer);
          el.reconnectTitle.textContent = 'Host Back Online!';
          el.reconnectMessage.textContent = 'Simulated connection restored. Refreshing metrics...';
          el.reconnectStatus.textContent = 'Online';
          setTimeout(() => {
            el.reconnectOverlay.classList.add('hidden');
            isReconnecting = false;
            enableStaticDemoMode();
          }, 1500);
        }
      }, 1200);
      return;
    }

    // Live ping polling
    const pingTimer = setInterval(async () => {
      pingAttempts++;
      el.reconnectStatus.textContent = `Ping attempt #${pingAttempts}...`;

      try {
        const res = await fetch('/api/ping', { cache: 'no-store' });
        if (res.ok) {
          clearInterval(pingTimer);
          el.reconnectTitle.textContent = 'Host Online!';
          el.reconnectMessage.textContent = 'Connection restored. Reloading dashboard...';
          el.reconnectStatus.textContent = 'Ready';
          setTimeout(() => {
            el.reconnectOverlay.classList.add('hidden');
            isReconnecting = false;
            window.location.reload();
          }, 2000);
        }
      } catch {
        // Still rebooting, keep waiting
      }
    }, 2500);
  }

  // Event Listeners
  el.btnRestart.addEventListener('click', () => {
    openConfirmModal('restart', selectedRestartDelay);
  });

  el.btnShutdown.addEventListener('click', () => {
    openConfirmModal('shutdown', selectedShutdownDelay);
  });

  el.modalBtnCancel.addEventListener('click', closeConfirmModal);
  el.modalBtnConfirm.addEventListener('click', executeConfirmedAction);

  // Close modal when clicking on the backdrop
  el.confirmModal.addEventListener('click', (e) => {
    const rect = el.confirmModal.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeConfirmModal();
    }
  });

  el.confirmModal.addEventListener('cancel', () => {
    pendingModalAction = null;
  });

  el.btnCancelAction.addEventListener('click', cancelScheduledAction);
  el.btnRefreshStats.addEventListener('click', () => {
    fetchStatus();
    showToast('Metrics refreshed', 'info');
  });

  // Initial Load and Polling
  fetchStatus();
  pollInterval = setInterval(() => {
    if (!isReconnecting && !isStaticHostingMode) {
      fetchStatus();
    }
  }, 3500);

  window.addEventListener('beforeunload', () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  });
})();
