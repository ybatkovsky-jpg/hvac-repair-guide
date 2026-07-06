/**
 * progress.js — Управление прогрессом обучения
 * Сохраняет состояние в LocalStorage
 */

const ProgressManager = (() => {
  const STORAGE_KEY = 'ac_guide_progress';

  // Структура данных прогресса
  const defaultProgress = () => ({
    completedModules: {},   // { moduleId: true }
    quizResults: {},        // { moduleId: { score, passed, attempts, lastAttempt } }
    currentModule: null,
    lastVisited: Date.now()
  });

  /**
   * Загрузить прогресс из localStorage
   */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return { ...defaultProgress(), ...data };
      }
    } catch (e) {
      console.warn('Failed to load progress:', e);
    }
    return defaultProgress();
  }

  /**
   * Сохранить прогресс в localStorage
   */
  function save(progress) {
    try {
      progress.lastVisited = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  }

  let state = load();

  /**
   * Отметить модуль как пройденный (контент прочитан)
   */
  function markModuleCompleted(moduleId) {
    state.completedModules[moduleId] = true;
    state.currentModule = moduleId;
    save(state);
  }

  /**
   * Сохранить результат теста
   */
  function saveQuizResult(moduleId, score, totalPoints, passed) {
    const prev = state.quizResults[moduleId] || { attempts: 0 };
    state.quizResults[moduleId] = {
      score,
      totalPoints,
      percentage: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
      passed,
      attempts: prev.attempts + 1,
      lastAttempt: Date.now()
    };
    save(state);
  }

  /**
   * Получить результат теста для модуля
   */
  function getQuizResult(moduleId) {
    return state.quizResults[moduleId] || null;
  }

  /**
   * Проверить, пройден ли модуль (контент)
   */
  function isModuleCompleted(moduleId) {
    return !!state.completedModules[moduleId];
  }

  /**
   * Проверить, сдан ли тест модуля
   */
  function isQuizPassed(moduleId) {
    const result = state.quizResults[moduleId];
    return result && result.passed;
  }

  /**
   * Получить общий процент завершения модулей
   */
  function getOverallProgress(totalModules) {
    if (totalModules === 0) return 0;
    let completed = 0;
    for (let i = 1; i <= totalModules; i++) {
      if (state.completedModules[i]) completed++;
    }
    return Math.round((completed / totalModules) * 100);
  }

  /**
   * Получить детальную статистику
   */
  function getStats(totalModules) {
    const modules = [];
    for (let i = 1; i <= totalModules; i++) {
      const quiz = state.quizResults[i];
      modules.push({
        id: i,
        contentRead: !!state.completedModules[i],
        quizTaken: !!quiz,
        quizPassed: quiz ? quiz.passed : false,
        quizScore: quiz ? quiz.percentage : null,
        attempts: quiz ? quiz.attempts : 0
      });
    }
    return {
      modules,
      totalCompleted: Object.keys(state.completedModules).length,
      totalPassed: Object.values(state.quizResults).filter(r => r.passed).length,
      totalModules
    };
  }

  /**
   * Полностью сбросить прогресс
   */
  function reset() {
    state = defaultProgress();
    save(state);
  }

  return {
    markModuleCompleted,
    saveQuizResult,
    getQuizResult,
    isModuleCompleted,
    isQuizPassed,
    getOverallProgress,
    getStats,
    reset,
    getState: () => state
  };
})();
