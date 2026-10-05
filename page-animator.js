document.addEventListener("DOMContentLoaded", () => {
    // Determine the current page theme/module based on URL
    const path = window.location.pathname;
    let moduleName = "SYSTEM_CORE";
    let loadMessages = ["INITIALIZING SAC_CORE...", "CALIBRATING SENSORS...", "ACCESS GRANTED"];

    if (path.includes("about.html")) {
        moduleName = "ABOUT_MODULE";
        loadMessages = ["LOADING: ABOUT MODULE...", "VERIFYING IDENTITY...", "ACCESS GRANTED"];
    } else if (path.includes("projects.html")) {
        moduleName = "PROJECTS_DB";
        loadMessages = ["ACCESSING PROJECT BLUEPRINTS...", "COMPILING SCHEMATICS...", "DATA LOADED"];
    } else if (path.includes("events.html")) {
        moduleName = "TIMELINE_SYNC";
        loadMessages = ["SYNCING TIMELINES...", "FETCHING EVENT LOGS...", "READY"];
    } else if (path.includes("team.html")) {
        moduleName = "TEAM_ROSTER";
        loadMessages = ["ASSEMBLING TEAM DATA...", "CONNECTING NODES...", "ROSTER ONLINE"];
    } else if (path.includes("join.html")) {
        moduleName = "RECRUIT_PROTOCOL";
        loadMessages = ["INITIALIZING RECRUITMENT...", "PREPARING FORMS...", "SYSTEM READY"];
    }

    const hasBooted = sessionStorage.getItem('sac_booted');

    if (!hasBooted) {
        // Inject Loader HTML for first time visit
        const loaderHTML = `
            <div id="sac-global-loader">
                <div class="sac-loader-bg"></div>
                <div class="sac-loader-content">
                    <div class="sac-loader-header">
                        <span class="sac-loader-title">[ ${moduleName} ]</span>
                        <span class="sac-loader-status">BOOTING...</span>
                    </div>
                    <div class="sac-loader-terminal" id="sac-terminal-text"></div>
                    <div class="sac-loader-bar">
                        <div class="sac-loader-progress"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', loaderHTML);

        const loader = document.getElementById('sac-global-loader');
        const terminal = document.getElementById('sac-terminal-text');
        const progress = document.querySelector('.sac-loader-progress');
        const pageWrapper = document.querySelector('.page-wrapper');

        // Initially hide the page content slightly
        if (pageWrapper) {
            pageWrapper.style.opacity = '0';
            pageWrapper.style.transform = 'translateY(20px)';
            pageWrapper.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
        }

        let msgIndex = 0;
        
        function typeMessage(msg, callback) {
            terminal.innerHTML = "";
            let i = 0;
            const speed = 30; // ms per char
            function typeChar() {
                if (i < msg.length) {
                    terminal.innerHTML += msg.charAt(i);
                    i++;
                    setTimeout(typeChar, speed);
                } else {
                    setTimeout(callback, 300); // Wait before next message
                }
            }
            typeChar();
        }

        function runSequence() {
            if (msgIndex < loadMessages.length) {
                progress.style.width = `${((msgIndex + 1) / loadMessages.length) * 100}%`;
                typeMessage(loadMessages[msgIndex], () => {
                    msgIndex++;
                    runSequence();
                });
            } else {
                // Sequence complete, hide loader and reveal page
                sessionStorage.setItem('sac_booted', 'true');
                setTimeout(() => {
                    loader.classList.add('loader-hidden');
                    
                    if (pageWrapper) {
                        pageWrapper.style.opacity = '1';
                        pageWrapper.style.transform = 'translateY(0)';
                    }

                    // Add page-specific entrance animations
                    applyPageAnimations(path);
                    
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 800); // match transition duration
                }, 500);
            }
        }

        // Start sequence
        setTimeout(runSequence, 200);
    } else {
        // Already booted in this session, skip to page animations
        const pageWrapper = document.querySelector('.page-wrapper');
        if (pageWrapper) {
            pageWrapper.style.opacity = '1';
            pageWrapper.style.transform = 'translateY(0)';
        }
        applyPageAnimations(path);
    }

    // Page-specific entrance animations
    function applyPageAnimations(path) {
        if (path.includes("index.html") || path === "/" || path === "") {
            // Home page: Glitch and fade up headings
            const heroText = document.querySelector('.home-meta');
            if (heroText) heroText.style.animation = "glitch-in 1s forwards";
            
            const headings = document.querySelectorAll('h1, h2, h3');
            headings.forEach((h, i) => {
                h.style.opacity = '0';
                h.style.transform = 'translateY(20px)';
                h.style.transition = `opacity 0.8s ease ${0.3 + (i * 0.15)}s, transform 0.8s ease ${0.3 + (i * 0.15)}s`;
                void h.offsetWidth;
                h.style.opacity = '1';
                h.style.transform = 'translateY(0)';
            });
        } 
        else if (path.includes("about.html")) {
            // About page: Slide in from left
            const elements = document.querySelectorAll('.about-page h1, .about-page p, .about-page img');
            elements.forEach((el, i) => {
                el.style.opacity = '0';
                el.style.transform = 'translateX(-30px)';
                el.style.transition = `opacity 0.6s ease ${0.2 + (i * 0.1)}s, transform 0.6s ease ${0.2 + (i * 0.1)}s`;
                void el.offsetWidth;
                el.style.opacity = '1';
                el.style.transform = 'translateX(0)';
            });
        }
        else if (path.includes("projects.html")) {
            // Projects page: Staggered scale up for project cards
            const cards = document.querySelectorAll('.project-card');
            cards.forEach((card, i) => {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                card.style.transition = `opacity 0.5s ease ${0.2 + (i * 0.1)}s, transform 0.5s ease ${0.2 + (i * 0.1)}s`;
                void card.offsetWidth;
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            });
        }
        else if (path.includes("team.html")) {
            // Team page: Rotate/flip in for team members
            const members = document.querySelectorAll('.team-member, .team-card, h2');
            members.forEach((m, i) => {
                m.style.opacity = '0';
                m.style.transform = 'rotateX(-20deg) translateY(20px)';
                m.style.transition = `opacity 0.6s ease ${0.2 + (i * 0.1)}s, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${0.2 + (i * 0.1)}s`;
                void m.offsetWidth;
                m.style.opacity = '1';
                m.style.transform = 'rotateX(0) translateY(0)';
            });
        }
        else if (path.includes("events.html")) {
            // Events page: Slide down
            const events = document.querySelectorAll('.event-card, .home-event-slide, h1');
            events.forEach((ev, i) => {
                ev.style.opacity = '0';
                ev.style.transform = 'translateY(-20px)';
                ev.style.transition = `opacity 0.5s ease ${0.2 + (i * 0.1)}s, transform 0.5s ease ${0.2 + (i * 0.1)}s`;
                void ev.offsetWidth;
                ev.style.opacity = '1';
                ev.style.transform = 'translateY(0)';
            });
        }
        else {
            // Default generic fade
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.8s ease';
            void document.body.offsetWidth;
            document.body.style.opacity = '1';
        }
    }
});
