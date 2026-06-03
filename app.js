document.addEventListener("DOMContentLoaded", () => {
    const TOTAL = 6;
    let cur = 0;
    let currentRevenue = 0;
    
    // API URL Base (Relative path to work on all network devices)
    const API_BASE = "";

    // DOM Elements - Navigation
    const dotsEl = document.getElementById('dots');

    // Build Dot indicators dynamically
    dotsEl.innerHTML = "";
    for (let i = 0; i < TOTAL; i++) {
        const b = document.createElement('button');
        b.className = 'dot' + (i === 0 ? ' on' : '');
        b.onclick = () => goTo(i);
        dotsEl.appendChild(b);
    }

    const ROTATION_INTERVAL = 10000; // 10 seconds per slide
    let rotationTimer = null;

    function startAutoRotation() {
        if (rotationTimer) clearInterval(rotationTimer);
        rotationTimer = setInterval(() => {
            // Only auto-rotate if the settings panel is not open and user is not editing inputs
            const isEditing = document.body.classList.contains("show-settings") || 
                              ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
            if (!isEditing) {
                go(1);
            }
        }, ROTATION_INTERVAL);
    }

    function resetAutoRotation() {
        startAutoRotation();
    }

    function goTo(n) {
        document.getElementById('s' + cur).classList.remove('active');
        dotsEl.children[cur].classList.remove('on');
        cur = n;
        document.getElementById('s' + cur).classList.add('active');
        dotsEl.children[cur].classList.add('on');
        
        if (cur === 4 && serverData) {
            renderMeta(serverData.revenue);
        }

        // Reset auto rotation timer on manual navigation
        resetAutoRotation();
    }

    function go(d) {
        goTo((cur + d + TOTAL) % TOTAL);
    }

    // Keyboard events
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(1);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(-1);
    });

    // Touch events for mobile swipes
    let sx = 0;
    document.addEventListener('touchstart', e => sx = e.touches[0].clientX);
    document.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    });

    // Fullscreen Toggle Listener
    const btnFullscreen = document.getElementById("btn-fullscreen");
    if (btnFullscreen) {
        btnFullscreen.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Erro ao ativar tela cheia: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    }

    // Dynamic backgrounds local loading (with cache-busting query parameter)
    const slides = document.querySelectorAll(".slide");
    slides.forEach((slide, index) => {
        if (index >= 4) return; // Background files exist for first 4 slides (bg1, bg2, bg3, bg4)
        const timestamp = new Date().getTime();
        const localPng = new Image();
        localPng.src = `backgrounds/bg${index + 1}.png?t=${timestamp}`;
        localPng.onload = () => {
            slide.style.backgroundImage = `url('${localPng.src}')`;
        };
        localPng.onerror = () => {
            const localJpg = new Image();
            localJpg.src = `backgrounds/bg${index + 1}.jpg?t=${timestamp}`;
            localJpg.onload = () => {
                slide.style.backgroundImage = `url('${localJpg.src}')`;
            };
        };
    });

    /* ==========================================================================
       1. Countdown calculations (Ticks on 1-second interval)
       ========================================================================== */
    let targetDates = {
        faprev_gold: "2026-09-03",
        congresso_5: "2027-04-09",
        alianca_prev: "2026-08-24"
    };

    function fmtDate(ds) {
        if (!ds) return '';
        return new Date(ds + 'T00:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function updateTimerBlock(prefixId, dateId, targetDateStr) {
        if (!targetDateStr) return;
        const target = new Date(targetDateStr + 'T00:00:00');
        const now = new Date();
        const diffMs = target - now;
        
        let days = "00", hours = "00", minutes = "00", seconds = "00";
        
        if (diffMs > 0) {
            const totalSeconds = Math.floor(diffMs / 1000);
            const d = Math.floor(totalSeconds / (3600 * 24));
            const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            
            days = String(d).padStart(2, '0');
            hours = String(h).padStart(2, '0');
            minutes = String(m).padStart(2, '0');
            seconds = String(s).padStart(2, '0');
        }
        
        const elD = document.getElementById(prefixId + "-days");
        const elH = document.getElementById(prefixId + "-hours");
        const elM = document.getElementById(prefixId + "-mins");
        const elS = document.getElementById(prefixId + "-secs");
        const elDate = document.getElementById(dateId);
        
        if (elD) elD.textContent = days;
        if (elH) elH.textContent = hours;
        if (elM) elM.textContent = minutes;
        if (elS) elS.textContent = seconds;
        if (elDate) elDate.textContent = fmtDate(targetDateStr);
    }

    /* ==========================================================================
       2. Elite Event Calendar (Dates configured for 2026 based on Current Date)
       ========================================================================== */
    const eliteDatas = [
        { mes: 'Maio',    datas: '29 e 30', dt: '2026-05-29' },
        { mes: 'Junho',   datas: '12 e 13', dt: '2026-06-12' },
        { mes: 'Julho',   datas: '10 e 11', dt: '2026-07-10' },
        { mes: 'Agosto',  datas: '21 e 22', dt: '2026-08-21' },
        { mes: 'Setembro', datas: '18 e 19', dt: '2026-09-18' },
        { mes: 'Outubro',  datas: '23 e 24', dt: '2026-10-23' },
        { mes: 'Novembro', datas: '13 e 14', dt: '2026-11-13' },
    ];

    function getNextEliteEvent() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Find first Elite event whose dateEnd (start date + 2 days) is in the future
        const next = eliteDatas.find(e => {
            const endD = new Date(e.dt + 'T23:59:59');
            return endD >= today;
        });
        return next || eliteDatas[eliteDatas.length - 1];
    }

    function renderElite() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const g = document.getElementById('elite-grid');
        if (!g) return;
        
        g.innerHTML = '';
        let nextDone = false;
        
        eliteDatas.forEach(e => {
            const d = new Date(e.dt + 'T00:00:00');
            const diff = Math.ceil((d - today) / 86400000);
            const past = diff < -1;
            const isNext = !past && !nextDone;
            
            if (isNext) {
                nextDone = true;
            }
            
            const row = document.createElement('div');
            row.className = 'mes-row' + (past ? ' past' : '') + (isNext ? ' next' : '');
            row.innerHTML = `
                <div class="mes-bar"></div>
                <div class="mes-info">
                    <div class="mes-nome">${e.mes}</div>
                    <div class="mes-datas">dias ${e.datas}</div>
                </div>
                <div class="mes-tag">${past ? 'realizado' : (isNext ? 'próximo' : 'em breve')}</div>
                <div class="mes-d">${past ? '✓' : diff + 'd'}</div>
            `;
            g.appendChild(row);
        });
    }

    function updateEliteTimer() {
        const today = new Date();
        const nextElite = getNextEliteEvent();
        
        const elDays = document.getElementById("elite-days");
        const elHours = document.getElementById("elite-hours");
        const elMins = document.getElementById("elite-mins");
        const elSecs = document.getElementById("elite-secs");
        const elNextDate = document.getElementById("elite-next-date");
        
        if (!nextElite) {
            if (elDays) elDays.textContent = "00";
            if (elHours) elHours.textContent = "00";
            if (elMins) elMins.textContent = "00";
            if (elSecs) elSecs.textContent = "00";
            if (elNextDate) elNextDate.textContent = "ciclo encerrado";
            return;
        }

        const target = new Date(nextElite.dt + 'T00:00:00');
        const diffMs = target - today;
        
        let days = "00", hours = "00", minutes = "00", seconds = "00";
        
        if (diffMs > 0) {
            const totalSeconds = Math.floor(diffMs / 1000);
            const d = Math.floor(totalSeconds / (3600 * 24));
            const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            
            days = String(d).padStart(2, '0');
            hours = String(h).padStart(2, '0');
            minutes = String(m).padStart(2, '0');
            seconds = String(s).padStart(2, '0');
            if (elNextDate) elNextDate.textContent = nextElite.mes + ' · dias ' + nextElite.datas;
        } else {
            const eventEnd = new Date(target.getTime() + 2 * 24 * 3600 * 1000);
            if (today <= eventEnd) {
                if (elNextDate) elNextDate.textContent = "Elite em Andamento!";
            } else {
                if (elNextDate) elNextDate.textContent = "Realizado";
            }
        }
        
        if (elDays) elDays.textContent = days;
        if (elHours) elHours.textContent = hours;
        if (elMins) elMins.textContent = minutes;
        if (elSecs) elSecs.textContent = seconds;
    }

    // Unified 1-second interval loop for ticking countdown timers
    function tickTimers() {
        updateTimerBlock("faprev", "faprev-datestr", targetDates.faprev_gold);
        updateTimerBlock("cong", "cong-datestr", targetDates.congresso_5);
        updateTimerBlock("alianca", "alianca-datestr", targetDates.alianca_prev);
        updateEliteTimer();
    }
    setInterval(tickTimers, 1000);

    /* ==========================================================================
       3. Hotmart Meta Progress Card
       ========================================================================== */
    const META = 12000000;
    
    function fmtBRL(n) {
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function triggerConfetti() {
        const container = document.body;
        if (!container) return;
        
        const colors = ['#00e676', '#c4b5fd', '#ffd54f', '#ffbe41', '#29b6f6'];
        
        for (let i = 0; i < 90; i++) {
            const p = document.createElement('div');
            p.className = 'confetti-particle';
            
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 12 + 6 + 'px';
            const left = Math.random() * 100 + '%';
            
            p.style.backgroundColor = color;
            p.style.width = size;
            p.style.height = size;
            p.style.left = left;
            p.style.top = '-20px';
            p.style.position = 'fixed';
            p.style.zIndex = '9999';
            p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            p.style.animation = 'particle-fly 3s cubic-bezier(0.1, 0.8, 0.3, 1) forwards';
            
            const tx = (Math.random() * 600 - 300) + 'px';
            const ty = (window.innerHeight + 100) + 'px';
            const rot = (Math.random() * 720 + 360) + 'deg';
            
            p.style.setProperty('--tx', tx);
            p.style.setProperty('--ty', ty);
            p.style.setProperty('--rot', rot);
            
            container.appendChild(p);
            
            setTimeout(() => {
                p.remove();
            }, 3000);
        }
    }

    function animateNumber(elementId, start, end, duration) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentVal = start + (end - start) * easeProgress;
            
            el.textContent = fmtBRL(currentVal);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = fmtBRL(end);
            }
        }
        
        requestAnimationFrame(update);
    }

    function renderMeta(val) {
        const startVal = currentRevenue;
        const endVal = val;
        currentRevenue = val;
        
        const pct = Math.min(100, Math.round(val / META * 100));
        const falta = META - val;
        
        document.getElementById('meta-fill').style.width = pct + '%';
        document.getElementById('meta-pct-bg').textContent = pct + '%';
        document.getElementById('meta-falta-val').textContent = fmtBRL(Math.max(0, falta));

        if (startVal === 0 || startVal === endVal) {
            document.getElementById('meta-atual').textContent = fmtBRL(endVal);
            return;
        }

        if (endVal > startVal) {
            // Mudar para o slide 5 (Meta de Faturamento - que virou index 4)
            goTo(4);

            const metaBox = document.querySelector('.meta-box');
            const metaFill = document.getElementById('meta-fill');
            
            if (metaBox) {
                metaBox.classList.remove('pulse-glow');
                void metaBox.offsetWidth; // trigger reflow
                metaBox.classList.add('pulse-glow');
                setTimeout(() => metaBox.classList.remove('pulse-glow'), 1200);
            }
            if (metaFill) {
                metaFill.classList.remove('pulse-bar');
                void metaFill.offsetWidth; // trigger reflow
                metaFill.classList.add('pulse-bar');
                setTimeout(() => metaFill.classList.remove('pulse-bar'), 1200);
            }

            animateNumber('meta-atual', startVal, endVal, 1500);
            triggerConfetti();
        } else {
            document.getElementById('meta-atual').textContent = fmtBRL(endVal);
        }
    }

    /* ==========================================================================
       4. Checklist Elite Rendering & Synchronization
       ========================================================================== */
    const items = [
        { id: 'bebidas',   label: 'Bebidas',           icon: '🥤' },
        { id: 'almoco',    label: 'Almoço',            icon: '🍽️' },
        { id: 'jantar',    label: 'Jantar',            icon: '🌙' },
        { id: 'vans',      label: 'Vans',              icon: '🚐' },
        { id: 'mesas',     label: 'Mesas / Champanheira', icon: '🥂' },
        { id: 'copos',     label: 'Copos de Café',     icon: '☕' },
        { id: 'painel',    label: 'Painel',            icon: '🖼️' },
        { id: 'frutas',    label: 'Frutas',            icon: '🍓' },
        { id: 'folders',   label: 'Folders / Cadernos', icon: '📁' },
        { id: 'trofeus',   label: 'Troféus',           icon: '🏆' },
        { id: 'plaquinhas', label: 'Plaquinhas',        icon: '🪧' },
        { id: 'tacas',     label: 'Taças de Brinde',   icon: '🥂' },
    ];

    function renderCk(checklist) {
        const g = document.getElementById('ck-grid');
        if (!g) return;
        
        g.innerHTML = '';
        items.forEach(it => {
            const done = !!checklist[it.id];
            const d = document.createElement('div');
            d.className = 'ci' + (done ? ' done' : '');
            d.innerHTML = `
                <div class="ci-box">${done ? '✓' : ''}</div>
                <span class="ci-icon">${it.icon}</span>
                <span class="ci-label">${it.label}</span>
            `;
            d.onclick = () => {
                toggleChecklistItem(it.id, !done);
            };
            g.appendChild(d);
        });
        
        const doneCount = Object.values(checklist).filter(Boolean).length;
        document.getElementById('ck-prog').textContent = doneCount + ' / ' + items.length;
        document.getElementById('prog-fill').style.width = Math.round(doneCount / items.length * 100) + '%';
    }

    async function toggleChecklistItem(itemId, status) {
        try {
            const response = await fetch(`${API_BASE}/api/checklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: itemId, status: status })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.status === "success") {
                    fetchData();
                }
            }
        } catch (e) {
            console.error("Erro ao marcar item no servidor:", e);
        }
    }

    async function resetChecklist() {
        if (!confirm('Resetar checklist?')) return;
        
        try {
            for (let it of items) {
                await fetch(`${API_BASE}/api/checklist`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ item: it.id, status: false })
                });
            }
            fetchData();
        } catch (e) {
            console.error("Erro ao resetar checklist:", e);
        }
    }

    /* ==========================================================================
       5. Server Data Polling & Sincronização
       ========================================================================== */
    let serverData = null;

    async function fetchData() {
        try {
            const response = await fetch(`${API_BASE}/api/data`);
            if (!response.ok) throw new Error("API call failed");
            const data = await response.json();
            serverData = data;

            // Update Faturamento
            renderMeta(data.revenue);
            
            const metaInput = document.getElementById("meta-val-inp");
            if (metaInput && document.activeElement !== metaInput) {
                metaInput.value = data.revenue.toFixed(2);
            }

            // Sync waiting list count from server
            if (data.waiting_list !== undefined) {
                const elWaiting = document.getElementById("elite-waiting-count");
                if (elWaiting) elWaiting.textContent = data.waiting_list;
                
                const waitingInput = document.getElementById("waiting-list-inp");
                if (waitingInput && document.activeElement !== waitingInput) {
                    waitingInput.value = data.waiting_list;
                }
            }

            // Sync target dates from server
            if (data.event_dates) {
                if (data.event_dates.faprev_gold) {
                    targetDates.faprev_gold = data.event_dates.faprev_gold;
                    const faprevInp = document.getElementById("faprev-inp");
                    if (faprevInp && document.activeElement !== faprevInp) {
                        faprevInp.value = data.event_dates.faprev_gold;
                    }
                }
                if (data.event_dates.congresso_5) {
                    targetDates.congresso_5 = data.event_dates.congresso_5;
                    const congInp = document.getElementById("cong-inp");
                    if (congInp && document.activeElement !== congInp) {
                        congInp.value = data.event_dates.congresso_5;
                    }
                }
                if (data.event_dates.alianca_prev) {
                    targetDates.alianca_prev = data.event_dates.alianca_prev;
                    const aliancaInp = document.getElementById("alianca-inp");
                    if (aliancaInp && document.activeElement !== aliancaInp) {
                        aliancaInp.value = data.event_dates.alianca_prev;
                    }
                }
            }

            // Force update timers on server fetch
            tickTimers();

            // Update Checklist
            renderCk(data.checklist);

            // Render Elite agenda
            renderElite();

            // Sync and render sales ranking
            if (data.sales_ranking) {
                renderSalesRanking(data.sales_ranking);
            }

        } catch (e) {
            console.error("Erro de sincronização com o servidor:", e);
        }
    }

    // Save Handlers (Sending POST to Python server)
    async function saveFaprevDate() {
        const v = document.getElementById('faprev-inp').value;
        if (!v) return;
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_dates: { faprev_gold: v }
                })
            });
            if (response.ok) {
                fetchData();
                alert("Data Faprev salva!");
            }
        } catch (e) {
            console.error("Erro ao salvar faprev:", e);
        }
    }

    async function saveCongressoDate() {
        const v = document.getElementById('cong-inp').value;
        if (!v) return;
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_dates: { congresso_5: v }
                })
            });
            if (response.ok) {
                fetchData();
                alert("Data Congresso salva!");
            }
        } catch (e) {
            console.error("Erro ao salvar congresso:", e);
        }
    }

    async function saveAliancaDate() {
        const v = document.getElementById('alianca-inp').value;
        if (!v) return;
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_dates: { alianca_prev: v }
                })
            });
            if (response.ok) {
                fetchData();
                alert("Data Aliança Prev salva!");
            }
        } catch (e) {
            console.error("Erro ao salvar aliança prev:", e);
        }
    }

    async function saveMetaValue() {
        const v = parseFloat(document.getElementById('meta-val-inp').value);
        if (isNaN(v)) return;
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revenue: v })
            });
            if (response.ok) {
                fetchData();
                alert("Faturamento atualizado!");
            }
        } catch (e) {
            console.error("Erro ao salvar faturamento:", e);
        }
    }

    async function saveWaitingList() {
        const v = parseInt(document.getElementById('waiting-list-inp').value);
        if (isNaN(v)) return;
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ waiting_list: v })
            });
            if (response.ok) {
                fetchData();
                alert("Lista de espera atualizada!");
            }
        } catch (e) {
            console.error("Erro ao salvar lista de espera:", e);
        }
    }

    // RENDER SALES RANKING
    function renderSalesRanking(ranking) {
        if (!ranking || !Array.isArray(ranking)) return;
        
        // Sort ranking: highest sales first
        const sorted = [...ranking].sort((a, b) => b.sales - a.sales);
        
        // 1st Lugar
        const first = sorted[0] || { name: "Jaciara", sales: 0, avatar: "backgrounds/jaciara.png" };
        const second = sorted[1] || { name: "Sidimaria", sales: 0, avatar: "backgrounds/sidimaria.png" };

        const name1 = document.getElementById("name-rank1");
        const sales1 = document.getElementById("sales-rank1");
        const avatar1 = document.getElementById("avatar-rank1");

        const name2 = document.getElementById("name-rank2");
        const sales2 = document.getElementById("sales-rank2");
        const avatar2 = document.getElementById("avatar-rank2");

        if (name1) name1.textContent = first.name;
        if (sales1) sales1.textContent = first.sales + (first.sales === 1 ? " venda" : " vendas");
        if (avatar1 && first.avatar) avatar1.src = first.avatar + "?t=" + new Date().getTime();

        if (name2) name2.textContent = second.name;
        if (sales2) sales2.textContent = second.sales + (second.sales === 1 ? " venda" : " vendas");
        if (avatar2 && second.avatar) avatar2.src = second.avatar + "?t=" + new Date().getTime();

        // Fill configuration inputs
        const inputJaciara = document.getElementById("rank-jaciara-inp");
        const inputSidi = document.getElementById("rank-sidi-inp");
        
        const jaciaraObj = ranking.find(s => s.name.toLowerCase() === "jaciara") || { sales: 0 };
        const sidiObj = ranking.find(s => s.name.toLowerCase() === "sidimaria") || { sales: 0 };

        if (inputJaciara && document.activeElement !== inputJaciara) {
            inputJaciara.value = jaciaraObj.sales;
        }
        if (inputSidi && document.activeElement !== inputSidi) {
            inputSidi.value = sidiObj.sales;
        }
    }

    async function saveSalesRanking() {
        const salesJaciara = parseInt(document.getElementById("rank-jaciara-inp").value) || 0;
        const salesSidi = parseInt(document.getElementById("rank-sidi-inp").value) || 0;
        
        try {
            const response = await fetch(`${API_BASE}/api/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sales_ranking: [
                        { name: "Jaciara", sales: salesJaciara, avatar: "backgrounds/jaciara.png" },
                        { name: "Sidimaria", sales: salesSidi, avatar: "backgrounds/sidimaria.png" }
                    ]
                })
            });
            if (response.ok) {
                fetchData();
                alert("Ranking comercial salvo!");
            }
        } catch (e) {
            console.error("Erro ao salvar ranking:", e);
        }
    }

    // Event Bindings
    document.getElementById("btn-save-faprev").addEventListener("click", saveFaprevDate);
    document.getElementById("btn-save-cong").addEventListener("click", saveCongressoDate);
    document.getElementById("btn-save-alianca").addEventListener("click", saveAliancaDate);
    document.getElementById("btn-save-waiting").addEventListener("click", saveWaitingList);
    document.getElementById("btn-save-meta").addEventListener("click", saveMetaValue);
    const btnSaveRanking = document.getElementById("btn-save-ranking");
    if (btnSaveRanking) {
        btnSaveRanking.addEventListener("click", saveSalesRanking);
    }
    document.getElementById("btn-reset-check").addEventListener("click", resetChecklist);

    // Settings Toggle Listener
    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
        btnSettings.addEventListener("click", () => {
            document.body.classList.toggle("show-settings");
        });
    }

    // Initial load, start polling, and start auto slide rotation
    fetchData();
    setInterval(fetchData, 3000);
    startAutoRotation();
});
