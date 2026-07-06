/**
 * quiz.js — Движок тестирования
 * Поддерживает: multiple_choice, matching, case_based, ordering
 */

const QuizEngine = (() => {
  let questions = [];
  let answers = {};         // { questionId: answerData }
  let currentModuleId = null;
  let container = null;
  let onSubmitCallback = null;

  const PASS_THRESHOLD = 80; // %

  /**
   * Инициализировать тест для модуля
   */
  function init(moduleId, quizData, targetContainer, onSubmit) {
    currentModuleId = moduleId;
    questions = quizData || [];
    answers = {};
    container = targetContainer;
    onSubmitCallback = onSubmit;

    renderQuiz();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Отрендерить весь тест
   */
  function renderQuiz() {
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    container.innerHTML = `
      <div class="quiz-header">
        <h2>📝 Тест по модулю</h2>
        <p class="quiz-meta">
          ${questions.length} вопросов &middot;
          ${totalPoints} баллов &middot;
          Проходной балл: ${PASS_THRESHOLD}%
        </p>
      </div>
      <div class="quiz-questions" id="quiz-questions">
        ${questions.map((q, i) => renderQuestion(q, i)).join('')}
      </div>
      <div class="quiz-actions text-center mt-3">
        <button class="btn btn-primary" id="btn-submit-quiz" aria-label="Проверить ответы">
          ✓ Проверить ответы
        </button>
      </div>
      <div id="quiz-results-container"></div>
    `;

    // Привязать обработчики
    bindQuestionEvents();
    document.getElementById('btn-submit-quiz').addEventListener('click', handleSubmit);
  }

  /**
   * Отрендерить один вопрос
   */
  function renderQuestion(q, index) {
    const typeLabels = {
      multiple_choice: 'Выбор одного ответа',
      case_based: 'Ситуационная задача',
      matching: 'На соответствие',
      ordering: 'На последовательность'
    };

    let bodyHtml = '';
    switch (q.type) {
      case 'multiple_choice':
      case 'case_based':
        bodyHtml = renderMultipleChoice(q, index);
        break;
      case 'matching':
        bodyHtml = renderMatching(q, index);
        break;
      case 'ordering':
        bodyHtml = renderOrdering(q, index);
        break;
      default:
        bodyHtml = renderMultipleChoice(q, index);
    }

    return `
      <div class="question-card" id="question-${index}" data-qid="${q.id}" data-type="${q.type}">
        <div class="question-number">Вопрос ${index + 1} из ${questions.length}</div>
        <span class="question-type">${typeLabels[q.type] || 'Вопрос'}</span>
        <div class="question-text">${q.question}</div>
        ${bodyHtml}
        <div class="explanation-box" id="explanation-${index}">
          <strong>💡 Пояснение:</strong> ${q.explanation || ''}
        </div>
      </div>
    `;
  }

  /**
   * Multiple choice / case-based rendering
   */
  function renderMultipleChoice(q, index) {
    return `
      <ul class="options-list" role="radiogroup" aria-label="Варианты ответа">
        ${q.options.map((opt, oi) => `
          <li class="option-item" role="radio" tabindex="0"
              data-qindex="${index}" data-oid="${opt.id}"
              aria-checked="false">
            <span class="option-marker">${String.fromCharCode(65 + oi)}</span>
            <span>${opt.text}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  /**
   * Matching rendering
   */
  function renderMatching(q, index) {
    // Shuffle right side
    const rightItems = q.pairs.map(p => p.right);
    const shuffled = [...rightItems].sort(() => Math.random() - 0.5);

    return `
      <div class="matching-pairs" id="matching-${index}">
        <ul class="matching-left">
          ${q.pairs.map((p, pi) => `
            <li class="matching-item matching-left-item" data-qindex="${index}" data-pair="${pi}" data-side="left">
              ${p.left}
            </li>
          `).join('')}
        </ul>
        <ul class="matching-right">
          ${shuffled.map((item, ri) => `
            <li class="matching-item matching-right-item" data-qindex="${index}" data-value="${item}" data-side="right">
              ${item}
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="matching-status mt-1" id="matching-status-${index}" style="font-size: var(--fs-sm); color: var(--c-text-secondary);">
        Выберите пару слева, затем справа
      </div>
    `;
  }

  /**
   * Ordering rendering
   */
  function renderOrdering(q, index) {
    // Shuffle items
    const items = q.items.map((text, i) => ({ text, originalIndex: i }));
    const shuffled = [...items].sort(() => Math.random() - 0.5);

    answers[q.id] = { type: 'ordering', items: shuffled.map(s => s.originalIndex) };

    return `
      <ul class="ordering-list" id="ordering-${index}">
        ${shuffled.map((item, oi) => `
          <li class="ordering-item" data-qindex="${index}" data-oidx="${item.originalIndex}" draggable="true">
            <span class="ordering-num">${oi + 1}.</span>
            <span>${item.text}</span>
          </li>
        `).join('')}
      </ul>
      <p class="mt-1" style="font-size: var(--fs-xs); color: var(--c-text-secondary);">
        ↕ Перетащите пункты в правильном порядке
      </p>
    `;
  }

  /**
   * Привязать обработчики событий
   */
  function bindQuestionEvents() {
    // Multiple choice
    container.querySelectorAll('.option-item').forEach(item => {
      item.addEventListener('click', () => selectOption(item));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectOption(item);
        }
      });
    });

    // Matching
    container.querySelectorAll('.matching-left-item').forEach(item => {
      item.addEventListener('click', () => selectMatchingLeft(item));
    });
    container.querySelectorAll('.matching-right-item').forEach(item => {
      item.addEventListener('click', () => selectMatchingRight(item));
    });

    // Ordering - drag and drop
    container.querySelectorAll('.ordering-item').forEach(item => {
      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('drop', handleDrop);
      item.addEventListener('dragend', handleDragEnd);
    });
  }

  /**
   * Выбор опции в multiple choice
   */
  function selectOption(item) {
    const qindex = parseInt(item.dataset.qindex);
    const oid = item.dataset.oid;
    const card = document.getElementById(`question-${qindex}`);

    // Снять выделение с других опций этого вопроса
    card.querySelectorAll('.option-item').forEach(opt => {
      opt.classList.remove('selected');
      opt.setAttribute('aria-checked', 'false');
    });

    // Выделить выбранную
    item.classList.add('selected');
    item.setAttribute('aria-checked', 'true');

    answers[questions[qindex].id] = { type: 'choice', value: oid };
  }

  /**
   * Matching: выбор левого элемента
   */
  let pendingLeft = null;
  function selectMatchingLeft(item) {
    const qindex = parseInt(item.dataset.qindex);
    const card = document.getElementById(`question-${qindex}`);

    // Снять все выделения
    card.querySelectorAll('.matching-item').forEach(el => el.classList.remove('selected'));

    item.classList.add('selected');
    pendingLeft = {
      qindex,
      pairIndex: parseInt(item.dataset.pair),
      element: item
    };

    document.getElementById(`matching-status-${qindex}`).textContent =
      'Теперь выберите соответствие справа';
  }

  function selectMatchingRight(item) {
    if (!pendingLeft) return;

    const qindex = parseInt(item.dataset.qindex);
    if (qindex !== pendingLeft.qindex) return;

    const leftIndex = pendingLeft.pairIndex;
    const rightValue = item.dataset.value;

    // Сохранить ответ
    if (!answers[questions[qindex].id]) {
      answers[questions[qindex].id] = { type: 'matching', pairs: {} };
    }
    answers[questions[qindex].id].pairs[leftIndex] = rightValue;

    // Визуально отметить
    pendingLeft.element.classList.add('matched');
    item.classList.add('matched', 'selected');

    const matchedCount = Object.keys(answers[questions[qindex].id].pairs).length;
    const totalPairs = questions[qindex].pairs.length;
    document.getElementById(`matching-status-${qindex}`).textContent =
      `Установлено соответствий: ${matchedCount} из ${totalPairs}`;

    pendingLeft = null;
  }

  /**
   * Ordering drag and drop
   */
  function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.oidx);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    const list = e.target.closest('.ordering-list');
    if (!list) return;

    const draggedItem = list.querySelector('.dragging');
    const targetItem = e.target.closest('.ordering-item');

    if (draggedItem && targetItem && draggedItem !== targetItem) {
      const items = [...list.querySelectorAll('.ordering-item')];
      const draggedIdx = items.indexOf(draggedItem);
      const targetIdx = items.indexOf(targetItem);

      if (draggedIdx < targetIdx) {
        targetItem.after(draggedItem);
      } else {
        targetItem.before(draggedItem);
      }

      updateOrderingAnswer(list);
    }
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
  }

  function updateOrderingAnswer(list) {
    const qindex = parseInt(list.id.replace('ordering-', ''));
    const items = [...list.querySelectorAll('.ordering-item')];
    const order = items.map(item => parseInt(item.dataset.oidx));

    answers[questions[qindex].id] = { type: 'ordering', items: order };

    // Update numbers
    items.forEach((item, i) => {
      item.querySelector('.ordering-num').textContent = `${i + 1}.`;
    });
  }

  /**
   * Обработка отправки теста
   */
  function handleSubmit() {
    // Проверить, на все ли вопросы даны ответы
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      const go = confirm(
        `Вы ответили не на все вопросы (осталось: ${unanswered.length}).\n` +
        'Хотите продолжить проверку?'
      );
      if (!go) return;
    }

    // Проверить matching на полноту
    let allAnswered = true;
    questions.forEach(q => {
      if (q.type === 'matching' && answers[q.id]) {
        const pairs = answers[q.id].pairs || {};
        if (Object.keys(pairs).length < q.pairs.length) {
          allAnswered = false;
        }
      }
    });
    if (!allAnswered) {
      const go = confirm(
        'Не для всех вопросов на соответствие выбраны пары. Продолжить?'
      );
      if (!go) return;
    }

    // Подсчёт результатов
    let totalScore = 0;
    let totalPoints = 0;

    questions.forEach((q, i) => {
      const card = document.getElementById(`question-${i}`);
      const userAnswer = answers[q.id];
      let isCorrect = false;

      switch (q.type) {
        case 'multiple_choice':
        case 'case_based':
          isCorrect = userAnswer && userAnswer.value === q.correct;
          break;
        case 'matching':
          if (userAnswer && userAnswer.pairs) {
            isCorrect = q.pairs.every((p, pi) =>
              userAnswer.pairs[pi] === p.right
            );
          }
          break;
        case 'ordering':
          if (userAnswer && userAnswer.items) {
            isCorrect = arraysEqual(userAnswer.items, q.correctOrder);
          }
          break;
      }

      const points = q.points || 1;
      totalPoints += points;
      if (isCorrect) totalScore += points;

      // Визуальная обратная связь
      card.classList.add('answered');
      if (isCorrect) {
        card.classList.add('correct');
      } else {
        card.classList.add('incorrect');
      }

      // Подсветка ответов
      highlightCorrectAnswer(card, q, userAnswer);
    });

    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    const passed = percentage >= PASS_THRESHOLD;

    // Показать результаты
    const resultsContainer = document.getElementById('quiz-results-container');
    resultsContainer.innerHTML = `
      <div class="quiz-results ${passed ? 'passed' : 'failed'}">
        <div class="quiz-score">${percentage}%</div>
        <p class="quiz-result-text">
          ${passed
            ? '🎉 Поздравляем! Тест сдан!'
            : '📚 Тест не сдан. Повторите материал и попробуйте снова.'}
        </p>
        <p style="color: var(--c-text-secondary); margin-bottom: 1.5rem;">
          Набрано ${totalScore} баллов из ${totalPoints}
          (проходной балл: ${PASS_THRESHOLD}%)
        </p>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          ${!passed ? '<button class="btn btn-primary" id="btn-retry-quiz">🔄 Пересдать тест</button>' : ''}
          <button class="btn btn-secondary" id="btn-back-to-module">← Вернуться к модулю</button>
        </div>
      </div>
    `;
    resultsContainer.scrollIntoView({ behavior: 'smooth' });

    // Отключить кнопку отправки
    const submitBtn = document.getElementById('btn-submit-quiz');
    if (submitBtn) submitBtn.disabled = true;

    // Привязать кнопки результатов
    const retryBtn = document.getElementById('btn-retry-quiz');
    if (retryBtn) retryBtn.addEventListener('click', () => {
      renderQuiz();
    });

    const backBtn = document.getElementById('btn-back-to-module');
    if (backBtn) backBtn.addEventListener('click', () => {
      if (onSubmitCallback) onSubmitCallback(currentModuleId);
    });

    // Сохранить результат
    if (onSubmitCallback) {
      ProgressManager.saveQuizResult(currentModuleId, totalScore, totalPoints, passed);
    }
  }

  /**
   * Подсветить правильные ответы после проверки
   */
  function highlightCorrectAnswer(card, q, userAnswer) {
    if (q.type === 'multiple_choice' || q.type === 'case_based') {
      card.querySelectorAll('.option-item').forEach(opt => {
        if (opt.dataset.oid === q.correct) {
          opt.classList.add('correct-answer');
        }
        if (userAnswer && opt.dataset.oid === userAnswer.value && opt.dataset.oid !== q.correct) {
          opt.classList.add('wrong-answer');
        }
      });
    }

    if (q.type === 'ordering') {
      const list = card.querySelector('.ordering-list');
      if (list) {
        const items = [...list.querySelectorAll('.ordering-item')];
        items.forEach((item, i) => {
          const oidx = parseInt(item.dataset.oidx);
          if (oidx === q.correctOrder[i]) {
            item.style.borderColor = 'var(--c-success)';
            item.style.background = 'var(--c-success-light)';
          } else {
            item.style.borderColor = 'var(--c-danger)';
            item.style.background = 'var(--c-danger-light)';
          }
        });
      }
    }
  }

  function arraysEqual(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }

  return {
    init,
    PASS_THRESHOLD
  };
})();
