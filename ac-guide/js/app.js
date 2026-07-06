/**
 * app.js — Основная логика SPA
 * Навигация, рендеринг модулей, глоссарий, статистика
 */

const App = (() => {
  let contentData = null;
  let modules = [];
  let currentView = 'welcome'; // welcome | module | quiz | glossary | stats
  let currentModuleId = null;

  // DOM элементы
  const els = {
    moduleList: null,
    moduleCount: null,
    progressRing: null,
    progressPercent: null,
    sectionWelcome: null,
    sectionModule: null,
    sectionQuiz: null,
    sectionGlossary: null,
    sectionStats: null,
    menuToggle: null,
    sidebar: null,
    body: null
  };

  /**
   * Инициализация приложения
   */
  async function init() {
    // Собрать DOM-ссылки
    els.moduleList = document.getElementById('module-list');
    els.moduleCount = document.getElementById('module-count');
    els.progressRing = document.getElementById('progress-ring');
    els.progressPercent = document.getElementById('progress-percent');
    els.sectionWelcome = document.getElementById('section-welcome');
    els.sectionModule = document.getElementById('section-module');
    els.sectionQuiz = document.getElementById('section-quiz');
    els.sectionGlossary = document.getElementById('section-glossary');
    els.sectionStats = document.getElementById('section-stats');
    els.menuToggle = document.querySelector('.menu-toggle');
    els.body = document.body;

	    // Загрузить данные контента (встроенные или через fetch)
	    if (window.COURSE_DATA) {
	      // Работает без сервера (file://)
	      contentData = window.COURSE_DATA;
	      modules = contentData.modules || [];
	    } else {
	      try {
	        const response = await fetch('data/content.json');
	        if (!response.ok) throw new Error(`HTTP ${response.status}`);
	        contentData = await response.json();
	        modules = contentData.modules || [];
	      } catch (e) {
	        console.error('Failed to load content:', e);
	        showError('Не удалось загрузить данные курса. Проверьте, что файл data/content.json доступен.');
	        return;
	      }
	    }

    // Построить меню
    buildModuleMenu();

    // Привязать события
    bindEvents();

    // Обновить прогресс
    updateProgress();

    // Показать welcome
    showWelcome();

    console.log(`App initialized: ${modules.length} modules loaded`);
  }

  /**
   * Построить боковое меню модулей
   */
  function buildModuleMenu() {
    els.moduleList.innerHTML = modules.map((mod, i) => {
      const mid = mod.id;
      const quizResult = ProgressManager.getQuizResult(mid);
      const completed = ProgressManager.isModuleCompleted(mid);

      let badge = '';
      if (quizResult && quizResult.passed) {
        badge = `<span class="module-link-badge passed">✓ ${quizResult.percentage}%</span>`;
      } else if (quizResult && !quizResult.passed) {
        badge = `<span class="module-link-badge failed">${quizResult.percentage}%</span>`;
      }

      const cls = completed ? 'completed' : '';
      return `
        <li>
          <a class="module-link ${cls}" data-module="${mid}" href="#module-${mid}"
             role="menuitem" tabindex="0">
            <span class="module-link-icon">${mid}</span>
            <span>${mod.title}</span>
            ${badge}
          </a>
        </li>
      `;
    }).join('');

    els.moduleCount.textContent = `${ProgressManager.getStats(modules.length).totalCompleted}/${modules.length}`;
  }

  /**
   * Привязать обработчики событий
   */
  function bindEvents() {
    // Мобильное меню
    els.menuToggle.addEventListener('click', toggleSidebar);

    // Оверлей для закрытия меню на мобильных
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebar);
    els.body.appendChild(overlay);

    // Клики по модулям
    els.moduleList.addEventListener('click', (e) => {
      const link = e.target.closest('.module-link');
      if (link) {
        e.preventDefault();
        const mid = parseInt(link.dataset.module);
        navigateToModule(mid);
        if (window.innerWidth < 768) closeSidebar();
      }
    });

    // Навигация в футере сайдбара
    document.querySelector('.sidebar-footer').addEventListener('click', (e) => {
      const link = e.target.closest('[data-nav]');
      if (link) {
        e.preventDefault();
        const nav = link.dataset.nav;
        if (nav === 'glossary') showGlossary();
      }
    });

    // Кнопка старта
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => {
        if (modules.length > 0) navigateToModule(modules[0].id);
      });
    }

    // Кнопка сброса прогресса
    const btnReset = document.getElementById('btn-reset-progress');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.')) {
          ProgressManager.reset();
          buildModuleMenu();
          updateProgress();
          showWelcome();
        }
      });
    }

    // Закрытие меню по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.body.classList.contains('sidebar-open')) {
        closeSidebar();
      }
    });
  }

  function toggleSidebar() {
    els.body.classList.toggle('sidebar-open');
    const expanded = els.body.classList.contains('sidebar-open');
    els.menuToggle.setAttribute('aria-expanded', expanded);
  }

  function closeSidebar() {
    els.body.classList.remove('sidebar-open');
    els.menuToggle.setAttribute('aria-expanded', 'false');
  }

  /**
   * Показать приветственный экран
   */
  function showWelcome() {
    hideAllSections();
    els.sectionWelcome.classList.remove('hidden');
    currentView = 'welcome';
    currentModuleId = null;
  }

  /**
   * Навигация к модулю
   */
  function navigateToModule(moduleId) {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;

    currentModuleId = moduleId;
    currentView = 'module';
    hideAllSections();
    els.sectionModule.classList.remove('hidden');
    renderModule(mod);

    // Активный пункт меню
    els.moduleList.querySelectorAll('.module-link').forEach(link => {
      link.classList.remove('active');
      if (parseInt(link.dataset.module) === moduleId) {
        link.classList.add('active');
      }
    });

    // Отметить как просмотренный
    ProgressManager.markModuleCompleted(moduleId);
    buildModuleMenu();
    updateProgress();
  }

  /**
   * Отрендерить модуль
   */
  function renderModule(mod) {
    const quizResult = ProgressManager.getQuizResult(mod.id);

    let quizButtonHtml = '';
    if (quizResult) {
      const statusIcon = quizResult.passed ? '✅' : '❌';
      quizButtonHtml = `
        <p style="font-size: var(--fs-sm); color: var(--c-text-secondary); margin-bottom: 0.5rem;">
          ${statusIcon} Последний результат: ${quizResult.percentage}%
          (${quizResult.score}/${quizResult.totalPoints} баллов, попыток: ${quizResult.attempts})
        </p>
        <button class="btn btn-primary" id="btn-start-quiz">🔄 Пересдать тест</button>
      `;
    } else {
      quizButtonHtml = `
        <button class="btn btn-primary" id="btn-start-quiz">📝 Пройти тест</button>
      `;
    }

    // Секции модуля
    const sectionsHtml = mod.sections.map(sec => {
      let secClass = 'content-section';
      if (sec.type === 'safety') secClass += ' safety-warning';

      return `
        <div class="${secClass}">
          <h3>${sec.title}</h3>
          ${sec.content}
          ${sec.images && sec.images.length > 0 ? sec.images.map(img =>
            `<img src="images/${img}" alt="Иллюстрация: ${sec.title}" loading="lazy" class="mt-2">`
          ).join('') : ''}
        </div>
      `;
    }).join('');

    // Чек-лист
    const checklistHtml = mod.checklist && mod.checklist.length > 0 ? `
      <div class="checklist-card">
        <h3>✅ Чек-лист: что нужно проверить</h3>
        <ul>
          ${mod.checklist.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    ` : '';

    // Ключевые термины
    const keytermsHtml = mod.keyTerms && mod.keyTerms.length > 0 ? `
      <div class="keyterms-card">
        <h3>📖 Ключевые термины</h3>
        <dl>
          ${mod.keyTerms.map(kt => `
            <dt>${kt.term}</dt>
            <dd>${kt.definition}</dd>
          `).join('')}
        </dl>
      </div>
    ` : '';

    // Навигация по модулям
    const currentIndex = modules.findIndex(m => m.id === mod.id);
    const prevMod = currentIndex > 0 ? modules[currentIndex - 1] : null;
    const nextMod = currentIndex < modules.length - 1 ? modules[currentIndex + 1] : null;

    const navHtml = `
      <div class="module-nav">
        <div>
          ${prevMod ? `<button class="btn btn-secondary btn-sm" id="btn-prev-module">← ${prevMod.title}</button>` : ''}
        </div>
        <div>
          ${nextMod ? `<button class="btn btn-secondary btn-sm" id="btn-next-module">${nextMod.title} →</button>` : ''}
        </div>
      </div>
    `;

    els.sectionModule.innerHTML = `
      <div class="module-header">
        <h2>Модуль ${mod.id}: ${mod.title}</h2>
        <div class="module-meta">
          <span>⏱ ${mod.timeEstimate || '30 мин'}</span>
          <span>📋 ${mod.sections.length} разделов</span>
        </div>
      </div>

      <div class="objectives-card">
        <h3>🎯 Цели обучения</h3>
        <ul>
          ${mod.objectives.map(obj => `<li>${obj}</li>`).join('')}
        </ul>
      </div>

      ${sectionsHtml}
      ${checklistHtml}
      ${keytermsHtml}

      <div class="text-center mt-3">
        ${quizButtonHtml}
      </div>

      ${navHtml}
    `;

    // Привязать кнопки
    const quizBtn = document.getElementById('btn-start-quiz');
    if (quizBtn) {
      quizBtn.addEventListener('click', () => startQuiz(mod));
    }

    const prevBtn = document.getElementById('btn-prev-module');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateToModule(prevMod.id));

    const nextBtn = document.getElementById('btn-next-module');
    if (nextBtn) nextBtn.addEventListener('click', () => navigateToModule(nextMod.id));

    els.sectionModule.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Запустить тест для модуля
   */
  function startQuiz(mod) {
    currentView = 'quiz';
    hideAllSections();
    els.sectionQuiz.classList.remove('hidden');

    QuizEngine.init(mod.id, mod.quiz, els.sectionQuiz, (moduleId) => {
      // Callback после теста — вернуться к модулю
      buildModuleMenu();
      updateProgress();
      navigateToModule(moduleId);
    });
  }

  /**
   * Показать глоссарий
   */
  function showGlossary() {
    currentView = 'glossary';
    hideAllSections();
    els.sectionGlossary.classList.remove('hidden');

    const glossary = contentData.glossary || [];
    const allTerms = [];
    modules.forEach(mod => {
      if (mod.keyTerms) {
        mod.keyTerms.forEach(kt => {
          if (!allTerms.find(t => t.term === kt.term)) {
            allTerms.push(kt);
          }
        });
      }
    });
    // Добавить из глобального глоссария
    glossary.forEach(gt => {
      if (!allTerms.find(t => t.term === gt.term)) {
        allTerms.push(gt);
      }
    });
    allTerms.sort((a, b) => a.term.localeCompare(b.term, 'ru'));

    els.sectionGlossary.innerHTML = `
      <div class="module-header">
        <h2>📖 Глоссарий</h2>
        <p class="module-meta">${allTerms.length} терминов</p>
      </div>
      <input type="search" class="glossary-search" id="glossary-search"
             placeholder="🔍 Поиск по терминам..." aria-label="Поиск по глоссарию">
      <dl class="glossary-list" id="glossary-list">
        ${allTerms.map(gt => `
          <dt>${gt.term}</dt>
          <dd>${gt.definition}</dd>
        `).join('')}
      </dl>
    `;

    // Поиск по глоссарию
    const searchInput = document.getElementById('glossary-search');
    const glossaryList = document.getElementById('glossary-list');
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      const items = glossaryList.querySelectorAll('dt, dd');
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (query === '' || text.includes(query)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });

    els.sectionGlossary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.innerWidth < 768) closeSidebar();
  }

  /**
   * Показать статистику
   */
  function showStats() {
    currentView = 'stats';
    hideAllSections();
    els.sectionStats.classList.remove('hidden');

    const stats = ProgressManager.getStats(modules.length);

    els.sectionStats.innerHTML = `
      <div class="module-header">
        <h2>📊 Статистика обучения</h2>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${stats.totalCompleted}</div>
          <div class="stat-label">Модулей изучено</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.totalPassed}</div>
          <div class="stat-label">Тестов сдано</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${ProgressManager.getOverallProgress(modules.length)}%</div>
          <div class="stat-label">Общий прогресс</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${modules.length}</div>
          <div class="stat-label">Всего модулей</div>
        </div>
      </div>

      <h3 style="margin-bottom: 1rem;">Детализация по модулям</h3>
      <div style="overflow-x: auto;">
        <table class="module-stats-table">
          <thead>
            <tr>
              <th>Модуль</th>
              <th>Контент</th>
              <th>Тест</th>
              <th>Результат</th>
              <th>Попыток</th>
            </tr>
          </thead>
          <tbody>
            ${modules.map(mod => {
              const ms = stats.modules.find(m => m.id === mod.id) || {};
              let statusHtml = '';
              if (ms.quizPassed) {
                statusHtml = `<span class="status-pass">✅ Сдан (${ms.quizScore}%)</span>`;
              } else if (ms.quizTaken) {
                statusHtml = `<span class="status-fail">❌ Не сдан (${ms.quizScore}%)</span>`;
              } else {
                statusHtml = `<span class="status-pending">—</span>`;
              }
              return `
                <tr>
                  <td><strong>${mod.id}. ${mod.title}</strong></td>
                  <td>${ms.contentRead ? '✅' : '—'}</td>
                  <td>${ms.quizTaken ? '✅' : '—'}</td>
                  <td>${statusHtml}</td>
                  <td>${ms.attempts || 0}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    els.sectionStats.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Обновить индикатор прогресса в шапке
   */
  function updateProgress() {
    const pct = ProgressManager.getOverallProgress(modules.length);
    els.progressPercent.textContent = `${pct}%`;

    const circumference = 97.39; // 2*PI*15.5
    const offset = circumference - (pct / 100) * circumference;
    els.progressRing.style.strokeDashoffset = offset;

    els.moduleCount.textContent =
      `${ProgressManager.getStats(modules.length).totalCompleted}/${modules.length}`;
  }

  /**
   * Скрыть все секции
   */
  function hideAllSections() {
    els.sectionWelcome.classList.add('hidden');
    els.sectionModule.classList.add('hidden');
    els.sectionQuiz.classList.add('hidden');
    els.sectionGlossary.classList.add('hidden');
    els.sectionStats.classList.add('hidden');
  }

  /**
   * Показать ошибку
   */
  function showError(message) {
    els.sectionWelcome.innerHTML = `
      <div class="welcome-hero">
        <h2 class="welcome-title" style="color: var(--c-danger);">⚠ Ошибка</h2>
        <p class="welcome-text">${message}</p>
      </div>
    `;
    els.sectionWelcome.classList.remove('hidden');
  }

  // Публичный API
  return {
    init,
    navigateToModule,
    showGlossary,
    showStats,
    getModules: () => modules
  };
})();

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Глобальная обработка хэша для прямых ссылок
  const handleHash = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#module-')) {
      const mid = parseInt(hash.replace('#module-', ''));
      if (!isNaN(mid)) App.navigateToModule(mid);
    } else if (hash === '#glossary') {
      App.showGlossary();
    } else if (hash === '#stats') {
      App.showStats();
    }
  };

  window.addEventListener('hashchange', handleHash);
  // Проверить хэш при загрузке
  if (window.location.hash) handleHash();
});
