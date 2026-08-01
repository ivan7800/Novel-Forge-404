(() => {
  'use strict';

  const LEGACY_STORAGE_KEY = 'novel-forge-404.projects.v1';
  const ACTIVE_KEY = 'novel-forge-404.active-project';
  const PREFS_KEY = 'novel-forge-404.preferences.v1';
  const DB_NAME = 'novel-forge-404';
  const DB_VERSION = 1;
  const DB_STORE = 'app-state';
  const DB_PROJECTS_KEY = 'projects';
  const FOLDER_HANDLE_PREFIX = 'folder-handle:';
  const AUTO_BACKUP_INTERVAL_MINUTES = 15;
  const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
  const MAX_ZIP_ENTRY_BYTES = 50 * 1024 * 1024;
  const MAX_ZIP_TOTAL_BYTES = 100 * 1024 * 1024;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = () => new Date().toISOString();
  const memoryStorage = new Map();
  const safeStorage = {
    getItem(key) {
      try { return window.localStorage.getItem(key); }
      catch { return memoryStorage.has(key) ? memoryStorage.get(key) : null; }
    },
    setItem(key, value) {
      const text = String(value);
      try {
        window.localStorage.setItem(key, text);
        return true;
      } catch {
        memoryStorage.set(key, text);
        return false;
      }
    },
    removeItem(key) {
      try { window.localStorage.removeItem(key); }
      catch { memoryStorage.delete(key); }
    }
  };

  let databasePromise = null;

  const state = {
    projects: [],
    activeProjectId: null,
    activeChapterId: null,
    activeSceneId: null,
    activeBibleId: null,
    splitSceneId: null,
    view: 'manuscript',
    commentFilter: 'open',
    folderHandle: null,
    autoBackupTimer: null,
    draggedScene: null,
    saveTimer: null,
    saveChain: Promise.resolve(),
    sessionStartWords: 0,
    speech: null,
    storageMode: 'indexeddb',
    storageWarningShown: false,
    dialogReturnFocus: null,
    preferences: {
      theme: 'dark',
      paper: 'light',
      editorFont: 'Georgia, "Times New Roman", serif',
      editorSize: 19,
      lineHeight: 1.75,
      indent: 1.5,
      autoTypography: true,
      autoBackupMinutes: AUTO_BACKUP_INTERVAL_MINUTES,
      backupReminderDays: 7
    }
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    await loadState();
    await loadFolderHandle();
    registerServiceWorker();
    applyPreferences();
    ensureActiveSelection();
    renderAll();
    state.sessionStartWords = projectWordCount(activeProject());
    updateSessionWords();
    updateStorageStatus();
    updateFolderStatus();
    startAutoBackups();
    checkBackupReminder();
  }

  function cacheElements() {
    Object.assign(els, {
      projectSelect: $('#projectSelect'),
      projectWords: $('#projectWords'),
      projectGoal: $('#projectGoal'),
      projectProgress: $('#projectProgress'),
      outline: $('#outline'),
      editor: $('#editor'),
      chapterTitle: $('#chapterTitle'),
      sceneTitle: $('#sceneTitle'),
      saveState: $('#saveState'),
      sceneWords: $('#sceneWords'),
      sceneChars: $('#sceneChars'),
      readTime: $('#readTime'),
      currentPath: $('#currentPath'),
      sessionWords: $('#sessionWords'),
      bibleList: $('#bibleList'),
      bibleEditor: $('#bibleEditor'),
      analysisCards: $('#analysisCards'),
      repetitionTable: $('#repetitionTable'),
      healthList: $('#healthList'),
      trashList: $('#trashList'),
      dialog: $('#genericDialog'),
      dialogForm: $('#dialogForm'),
      dialogTitle: $('#dialogTitle'),
      dialogBody: $('#dialogBody'),
      dialogActions: $('#dialogActions'),
      fileInput: $('#fileInput'),
      toastRegion: $('#toastRegion'),
      storageStatus: $('#storageStatus'),
      panelBackdrop: $('#panelBackdrop'),
      cardsBoard: $('#cardsBoard'),
      timelineSummary: $('#timelineSummary'),
      timelineList: $('#timelineList'),
      clueHealth: $('#clueHealth'),
      cluesList: $('#cluesList'),
      continuityHealth: $('#continuityHealth'),
      continuityList: $('#continuityList'),
      commentsFilters: $('#commentsFilters'),
      commentsList: $('#commentsList'),
      commentBadge: $('#commentBadge'),
      splitPane: $('#splitPane'),
      splitSceneSelect: $('#splitSceneSelect'),
      splitSceneTitle: $('#splitSceneTitle'),
      splitEditor: $('#splitEditor'),
      editorSplitShell: $('#editorSplitShell'),
      folderStatus: $('#folderStatus'),
      metaPov: $('#metaPov'),
      metaStatus: $('#metaStatus'),
      metaPlace: $('#metaPlace'),
      metaDate: $('#metaDate'),
      metaTime: $('#metaTime'),
      metaAct: $('#metaAct'),
      metaTension: $('#metaTension'),
      metaTensionValue: $('#metaTensionValue'),
      metaSummary: $('#metaSummary'),
      metaParticipants: $('#metaParticipants'),
      metaKnowledge: $('#metaKnowledge'),
      metaInventory: $('#metaInventory'),
      metaGoal: $('#metaGoal'),
      metaConflict: $('#metaConflict'),
      metaOutcome: $('#metaOutcome'),
      metaNotes: $('#metaNotes')
    });
  }

  function bindEvents() {
    document.addEventListener('click', handleGlobalClick);
    els.projectSelect.addEventListener('change', () => switchProject(els.projectSelect.value));
    els.editor.addEventListener('input', () => {
      const scene = activeScene();
      if (!scene) return;
      scene.html = sanitizeEditorHtml(els.editor.innerHTML);
      scene.updatedAt = nowIso();
      activeProject().updatedAt = nowIso();
      updateSceneStats();
      updateProjectProgress();
      scheduleSave();
    });
    els.editor.addEventListener('paste', handleEditorPaste);
    els.editor.addEventListener('keydown', handleEditorShortcuts);
    els.chapterTitle.addEventListener('input', () => {
      const chapter = activeChapter();
      if (!chapter) return;
      chapter.title = els.chapterTitle.value || 'Capítulo sin título';
      renderOutline();
      updatePath();
      scheduleSave();
    });
    els.sceneTitle.addEventListener('input', () => {
      const scene = activeScene();
      if (!scene) return;
      scene.title = els.sceneTitle.value || 'Escena sin título';
      renderOutline();
      updatePath();
      scheduleSave();
    });
    [els.metaPov, els.metaStatus, els.metaPlace, els.metaDate, els.metaTime, els.metaAct, els.metaTension, els.metaSummary, els.metaParticipants, els.metaKnowledge, els.metaInventory, els.metaGoal, els.metaConflict, els.metaOutcome, els.metaNotes]
      .forEach(input => input.addEventListener('input', saveMetadataFromInspector));
    els.metaTension?.addEventListener('input', () => { if (els.metaTensionValue) els.metaTensionValue.textContent = `${els.metaTension.value}/5`; });
    els.splitSceneSelect?.addEventListener('change', () => { state.splitSceneId = els.splitSceneSelect.value; renderSplitEditor(); });
    els.splitEditor?.addEventListener('input', saveSplitEditor);
    els.splitEditor?.addEventListener('paste', handleSplitEditorPaste);
    els.splitEditor?.addEventListener('keydown', handleSplitEditorShortcuts);
    els.splitSceneTitle?.addEventListener('input', saveSplitTitle);
    els.fileInput.addEventListener('change', handleFiles);
    els.dialog.addEventListener('close', restoreDialogFocus);
    window.addEventListener('beforeunload', flushSave);
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closePanels();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushSave();
    });
  }

  function handleGlobalClick(event) {
    const actionButton = event.target.closest('[data-action]');
    const commandButton = event.target.closest('[data-command]');
    const insertButton = event.target.closest('[data-insert]');
    const pairButton = event.target.closest('[data-pair]');
    const viewButton = event.target.closest('[data-view]');
    const outlineButton = event.target.closest('[data-outline-type]');
    const outlineMenuButton = event.target.closest('[data-outline-menu-type]');
    const bibleButton = event.target.closest('[data-bible-id]');

    if (commandButton) {
      event.preventDefault();
      els.editor.focus();
      document.execCommand(commandButton.dataset.command, false);
      return;
    }
    if (insertButton) {
      event.preventDefault();
      insertAtCursor(insertButton.dataset.insert);
      return;
    }
    if (pairButton) {
      event.preventDefault();
      const [open, close] = pairButton.dataset.pair.split('|');
      surroundSelection(open, close);
      return;
    }
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }
    if (outlineMenuButton) {
      showOutlineMenu(
        outlineMenuButton.dataset.outlineMenuType,
        outlineMenuButton.dataset.chapterId,
        outlineMenuButton.dataset.sceneId || null
      );
      return;
    }
    if (outlineButton) {
      selectOutline(outlineButton.dataset.outlineType, outlineButton.dataset.chapterId, outlineButton.dataset.sceneId);
      return;
    }
    if (bibleButton) {
      state.activeBibleId = bibleButton.dataset.bibleId;
      renderBible();
      return;
    }
    if (!actionButton) return;

    const actions = {
      'new-project': showNewProjectDialog,
      'project-info': showProjectInfoDialog,
      'import': showImportDialog,
      'export': showExportDialog,
      'save-folder': saveBackupToLinkedFolder,
      'focus': toggleFocusMode,
      'settings': showSettingsDialog,
      'add-chapter': addChapter,
      'add-scene': addScene,
      'normalize': showNormalizeDialog,
      'find': showFindDialog,
      'read-aloud': toggleReadAloud,
      'add-comment': showAddCommentDialog,
      'compare-versions': showCompareVersionsDialog,
      'toggle-split': toggleSplitEditor,
      'close-split': closeSplitEditor,
      'toggle-inspector': toggleInspector,
      'toggle-sidebar': toggleSidebar,
      'mobile-actions': showMobileActionsDialog,
      'close-panels': closePanels,
      'add-bible-entry': showNewBibleEntryDialog,
      'refresh-analysis': renderAnalysis,
      'refresh-timeline': renderTimeline,
      'add-clue': showClueDialog,
      'add-continuity': showContinuityDialog,
      'empty-trash': emptyTrash,
      'close-dialog': closeDialog
    };
    const handler = actions[actionButton.dataset.action];
    if (handler) handler();
  }

  async function loadState() {
    state.activeProjectId = safeStorage.getItem(ACTIVE_KEY);
    try {
      const prefs = JSON.parse(safeStorage.getItem(PREFS_KEY) || '{}');
      state.preferences = { ...state.preferences, ...prefs };
    } catch {
      safeStorage.removeItem(PREFS_KEY);
    }

    let storedProjects = null;
    try {
      storedProjects = await databaseGet(DB_PROJECTS_KEY);
      state.storageMode = 'indexeddb';
    } catch (error) {
      console.warn('IndexedDB no está disponible; se usará almacenamiento de compatibilidad.', error);
      state.storageMode = 'localstorage';
    }

    if (!Array.isArray(storedProjects)) {
      try {
        const legacy = JSON.parse(safeStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
        if (Array.isArray(legacy) && legacy.length) {
          storedProjects = legacy;
          if (state.storageMode === 'indexeddb') {
            await databaseSet(DB_PROJECTS_KEY, legacy);
            safeStorage.removeItem(LEGACY_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('No se pudo migrar el almacenamiento anterior', error);
      }
    }

    state.projects = Array.isArray(storedProjects) ? storedProjects.map(migrateProject) : [];
    if (!state.projects.length) {
      const project = createSampleProject();
      state.projects.push(project);
      state.activeProjectId = project.id;
      await persistImmediately();
    }
  }

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB no compatible'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
      request.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña'));
    });
    return databasePromise;
  }

  async function databaseGet(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readonly');
      const request = transaction.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo leer IndexedDB'));
    });
  }

  async function databaseSet(key, value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, 'readwrite');
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo escribir IndexedDB'));
      transaction.onabort = () => reject(transaction.error || new Error('La escritura en IndexedDB fue cancelada'));
    });
  }

  function migrateProject(project = {}) {
    const migrated = {
      id: safeString(project.id, 180) || uid('project'),
      title: safeString(project.title, 240) || 'Novela sin título',
      subtitle: safeString(project.subtitle, 400),
      author: safeString(project.author, 240) || 'I. Roig',
      genre: safeString(project.genre, 240),
      synopsis: safeString(project.synopsis, 20000),
      language: safeString(project.language, 20) || 'es-ES',
      goal: clampNumber(project.goal, 1000, 5000000, 80000),
      createdAt: safeIsoDate(project.createdAt),
      updatedAt: safeIsoDate(project.updatedAt),
      lastBackupAt: project.lastBackupAt ? safeIsoDate(project.lastBackupAt) : '',
      chapters: Array.isArray(project.chapters) ? project.chapters.slice(0, 5000) : [],
      bible: Array.isArray(project.bible) ? project.bible.slice(0, 10000) : [],
      trash: Array.isArray(project.trash) ? project.trash.slice(0, 5000) : [],
      snapshots: Array.isArray(project.snapshots) ? project.snapshots.slice(0, 20) : [],
      clues: Array.isArray(project.clues) ? project.clues.slice(0, 5000) : [],
      continuity: Array.isArray(project.continuity) ? project.continuity.slice(0, 10000) : [],
      comments: Array.isArray(project.comments) ? project.comments.slice(0, 20000) : [],
      lastAutoBackupAt: project.lastAutoBackupAt ? safeIsoDate(project.lastAutoBackupAt) : '',
      lastFolderSaveAt: project.lastFolderSaveAt ? safeIsoDate(project.lastFolderSaveAt) : ''
    };
    migrated.chapters = migrated.chapters.map((chapter, chapterIndex) => ({
      id: safeString(chapter?.id, 180) || uid('chapter'),
      title: safeString(chapter?.title, 240) || `Capítulo ${chapterIndex + 1}`,
      notes: safeString(chapter?.notes, 20000),
      scenes: (Array.isArray(chapter?.scenes) && chapter.scenes.length ? chapter.scenes.slice(0, 5000) : [createScene(1)]).map((scene, sceneIndex) => ({
        id: safeString(scene?.id, 180) || uid('scene'),
        title: safeString(scene?.title, 240) || `Escena ${sceneIndex + 1}`,
        html: sanitizeEditorHtml(safeString(scene?.html, 10000000) || '<p></p>'),
        meta: sanitizeMeta(scene?.meta),
        createdAt: safeIsoDate(scene?.createdAt),
        updatedAt: safeIsoDate(scene?.updatedAt)
      }))
    }));
    migrated.bible = migrated.bible.map(entry => ({
      id: safeString(entry?.id, 180) || uid('bible'),
      name: safeString(entry?.name, 240) || 'Ficha sin nombre',
      type: safeString(entry?.type, 80) || 'Documentación',
      tags: Array.isArray(entry?.tags) ? entry.tags.slice(0, 100).map(tag => safeString(tag, 80)).filter(Boolean) : [],
      summary: safeString(entry?.summary, 20000),
      content: safeString(entry?.content, 200000),
      createdAt: safeIsoDate(entry?.createdAt),
      updatedAt: safeIsoDate(entry?.updatedAt)
    }));
    migrated.clues = migrated.clues.map(sanitizeClue);
    migrated.continuity = migrated.continuity.map(sanitizeContinuity);
    migrated.comments = migrated.comments.map(sanitizeComment);
    migrated.trash = migrated.trash.map(migrateTrashItem).filter(Boolean);
    migrated.snapshots = migrated.snapshots.map(snapshot => ({
      id: safeString(snapshot?.id, 180) || uid('snapshot'),
      name: safeString(snapshot?.name, 240) || 'Instantánea',
      createdAt: safeIsoDate(snapshot?.createdAt),
      auto: Boolean(snapshot?.auto),
      data: safeString(snapshot?.data, 50000000)
    })).filter(snapshot => snapshot.data);
    if (!migrated.chapters.length) migrated.chapters = [createChapter(1)];
    return migrated;
  }

  function migrateTrashItem(item) {
    if (!item || !['chapter', 'scene', 'bible'].includes(item.type)) return null;
    const base = { id: safeString(item.id, 180) || uid('trash'), type: item.type, deletedAt: safeIsoDate(item.deletedAt) };
    if (item.type === 'bible') {
      const data = item.data || {};
      return { ...base, data: {
        id: safeString(data.id, 180) || uid('bible'), name: safeString(data.name, 240) || 'Ficha sin nombre',
        type: safeString(data.type, 80) || 'Documentación', tags: Array.isArray(data.tags) ? data.tags.map(tag => safeString(tag, 80)).filter(Boolean) : [],
        summary: safeString(data.summary, 20000), content: safeString(data.content, 200000), createdAt: safeIsoDate(data.createdAt), updatedAt: safeIsoDate(data.updatedAt)
      }};
    }
    if (item.type === 'scene') {
      const data = item.data || {};
      return { ...base, parentChapterId: safeString(item.parentChapterId, 180), data: {
        id: safeString(data.id, 180) || uid('scene'), title: safeString(data.title, 240) || 'Escena recuperada',
        html: sanitizeEditorHtml(safeString(data.html, 10000000) || '<p></p>'), meta: sanitizeMeta(data.meta),
        createdAt: safeIsoDate(data.createdAt), updatedAt: safeIsoDate(data.updatedAt)
      }};
    }
    const data = item.data || {};
    return { ...base, data: {
      id: safeString(data.id, 180) || uid('chapter'), title: safeString(data.title, 240) || 'Capítulo recuperado', notes: safeString(data.notes, 20000),
      scenes: (Array.isArray(data.scenes) && data.scenes.length ? data.scenes : [createScene(1)]).map((scene, index) => ({
        id: safeString(scene?.id, 180) || uid('scene'), title: safeString(scene?.title, 240) || `Escena ${index + 1}`,
        html: sanitizeEditorHtml(safeString(scene?.html, 10000000) || '<p></p>'), meta: sanitizeMeta(scene?.meta),
        createdAt: safeIsoDate(scene?.createdAt), updatedAt: safeIsoDate(scene?.updatedAt)
      }))
    }};
  }

  function sanitizeMeta(meta = {}) {
    const clean = emptyMeta();
    Object.keys(clean).forEach(key => {
      clean[key] = key === 'tags'
        ? (Array.isArray(meta?.tags) ? meta.tags.slice(0, 100).map(tag => safeString(tag, 80)).filter(Boolean) : [])
        : safeString(meta?.[key], key === 'notes' ? 50000 : 5000);
    });
    clean.status = safeString(meta?.status, 80) || 'Idea';
    return clean;
  }

  function sanitizeClue(clue = {}) {
    const allowed = ['Idea', 'Sembrada', 'Reforzada', 'Revelada', 'Resuelta'];
    return {
      id: safeString(clue.id, 180) || uid('clue'),
      title: safeString(clue.title, 240) || 'Pista sin título',
      description: safeString(clue.description, 30000),
      status: allowed.includes(clue.status) ? clue.status : 'Idea',
      seedSceneId: safeString(clue.seedSceneId, 180),
      reinforceSceneId: safeString(clue.reinforceSceneId, 180),
      revealSceneId: safeString(clue.revealSceneId, 180),
      resolveSceneId: safeString(clue.resolveSceneId, 180),
      knownBy: safeString(clue.knownBy, 5000),
      falseMeaning: safeString(clue.falseMeaning, 10000),
      notes: safeString(clue.notes, 30000),
      createdAt: safeIsoDate(clue.createdAt),
      updatedAt: safeIsoDate(clue.updatedAt)
    };
  }

  function sanitizeContinuity(item = {}) {
    return {
      id: safeString(item.id, 180) || uid('continuity'),
      entity: safeString(item.entity, 240) || 'Elemento sin nombre',
      category: safeString(item.category, 80) || 'Otro',
      attribute: safeString(item.attribute, 240) || 'Estado',
      value: safeString(item.value, 10000),
      fromSceneId: safeString(item.fromSceneId, 180),
      toSceneId: safeString(item.toSceneId, 180),
      notes: safeString(item.notes, 30000),
      createdAt: safeIsoDate(item.createdAt),
      updatedAt: safeIsoDate(item.updatedAt)
    };
  }

  function sanitizeComment(comment = {}) {
    return {
      id: safeString(comment.id, 180) || uid('comment'),
      sceneId: safeString(comment.sceneId, 180),
      excerpt: safeString(comment.excerpt, 5000),
      note: safeString(comment.note, 30000),
      type: safeString(comment.type, 80) || 'Revisión',
      resolved: Boolean(comment.resolved),
      createdAt: safeIsoDate(comment.createdAt),
      updatedAt: safeIsoDate(comment.updatedAt)
    };
  }

  function safeString(value, maxLength = 10000) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\u0000/g, '').slice(0, maxLength);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function safeIsoDate(value) {
    const date = new Date(value || Date.now());
    return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
  }

  function createSampleProject() {
    return {
      id: uid('project'),
      title: 'Mi nueva novela',
      subtitle: '',
      author: 'I. Roig',
      genre: 'Thriller / Misterio',
      synopsis: '',
      language: 'es-ES',
      goal: 80000,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastBackupAt: '',
      chapters: [{
        id: uid('chapter'),
        title: 'Capítulo 1',
        notes: '',
        scenes: [{
          id: uid('scene'),
          title: 'Escena 1',
          html: '<p>—Empieza aquí tu historia.</p><p>Puedes escribir directamente, pegar texto existente o importar un archivo desde el menú superior.</p>',
          meta: { ...emptyMeta(), status: 'Borrador' },
          createdAt: nowIso(),
          updatedAt: nowIso()
        }]
      }],
      bible: [],
      trash: [],
      snapshots: [],
      clues: [],
      continuity: [],
      comments: [],
      lastAutoBackupAt: '',
      lastFolderSaveAt: ''
    };
  }

  function createChapter(number) {
    return {
      id: uid('chapter'),
      title: `Capítulo ${number}`,
      notes: '',
      scenes: [createScene(1)]
    };
  }

  function createScene(number) {
    return {
      id: uid('scene'),
      title: `Escena ${number}`,
      html: '<p></p>',
      meta: emptyMeta(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  function emptyMeta() {
    return {
      pov: '', status: 'Idea', place: '', date: '', time: '', act: '',
      tension: '3', summary: '', participants: '', knowledge: '', inventory: '',
      goal: '', conflict: '', outcome: '', notes: '', tags: []
    };
  }

  function activeProject() {
    return state.projects.find(project => project.id === state.activeProjectId) || null;
  }

  function activeChapter() {
    return activeProject()?.chapters.find(chapter => chapter.id === state.activeChapterId) || null;
  }

  function activeScene() {
    return activeChapter()?.scenes.find(scene => scene.id === state.activeSceneId) || null;
  }

  function ensureActiveSelection() {
    let project = activeProject();
    if (!project) {
      project = state.projects[0];
      state.activeProjectId = project.id;
    }
    let chapter = project.chapters.find(item => item.id === state.activeChapterId);
    if (!chapter) {
      chapter = project.chapters[0];
      state.activeChapterId = chapter.id;
    }
    let scene = chapter.scenes.find(item => item.id === state.activeSceneId);
    if (!scene) {
      scene = chapter.scenes[0];
      state.activeSceneId = scene.id;
    }
    safeStorage.setItem(ACTIVE_KEY, state.activeProjectId);
  }

  function renderAll() {
    renderProjectSelector();
    renderOutline();
    renderEditor();
    renderCards();
    renderTimeline();
    renderClues();
    renderContinuity();
    renderComments();
    renderBible();
    renderTrash();
    renderAnalysis();
    setView(state.view);
    updateProjectProgress();
  }

  function renderProjectSelector() {
    els.projectSelect.innerHTML = state.projects.map(project =>
      `<option value="${escapeAttr(project.id)}" ${project.id === state.activeProjectId ? 'selected' : ''}>${escapeHtml(project.title)}</option>`
    ).join('');
  }

  function renderOutline() {
    const project = activeProject();
    if (!project) return;
    els.outline.innerHTML = project.chapters.map(chapter => {
      const chapterWords = chapter.scenes.reduce((sum, scene) => sum + countWords(htmlToText(scene.html)), 0);
      const scenes = chapter.scenes.map(scene => {
        const active = scene.id === state.activeSceneId;
        return `<div class="outline-row scene-row ${active ? 'active' : ''}" role="none">
          <button type="button" class="outline-select" role="treeitem" aria-selected="${active}" data-outline-type="scene" data-chapter-id="${escapeAttr(chapter.id)}" data-scene-id="${escapeAttr(scene.id)}">
            <span class="outline-title">${escapeHtml(scene.title)}</span>
            <span class="outline-count">${formatNumber(countWords(htmlToText(scene.html)))}</span>
          </button>
          <button type="button" class="outline-menu" data-outline-menu-type="scene" data-chapter-id="${escapeAttr(chapter.id)}" data-scene-id="${escapeAttr(scene.id)}" aria-label="Opciones de ${escapeAttr(scene.title)}">⋮</button>
        </div>`;
      }).join('');
      const chapterActive = chapter.id === state.activeChapterId;
      return `<div class="outline-chapter" role="group" aria-label="${escapeAttr(chapter.title)}">
        <div class="outline-row chapter-row ${chapterActive ? 'active' : ''}" role="none">
          <button type="button" class="outline-select" role="treeitem" aria-selected="${chapterActive}" data-outline-type="chapter" data-chapter-id="${escapeAttr(chapter.id)}">
            <span aria-hidden="true">▾</span>
            <span class="outline-title">${escapeHtml(chapter.title)}</span>
            <span class="outline-count">${formatNumber(chapterWords)}</span>
          </button>
          <button type="button" class="outline-menu" data-outline-menu-type="chapter" data-chapter-id="${escapeAttr(chapter.id)}" aria-label="Opciones de ${escapeAttr(chapter.title)}">⋮</button>
        </div>
        ${scenes}
      </div>`;
    }).join('');
  }

  function renderEditor() {
    const chapter = activeChapter();
    const scene = activeScene();
    if (!chapter || !scene) return;
    els.chapterTitle.value = chapter.title;
    els.sceneTitle.value = scene.title;
    els.editor.innerHTML = scene.html || '<p></p>';
    loadInspector(scene.meta);
    updateSceneStats();
    updatePath();
    renderSplitEditor();
  }

  function loadInspector(meta) {
    els.metaPov.value = meta.pov || '';
    els.metaStatus.value = meta.status || 'Idea';
    els.metaPlace.value = meta.place || '';
    els.metaDate.value = meta.date || '';
    els.metaTime.value = meta.time || '';
    els.metaAct.value = meta.act || '';
    els.metaTension.value = meta.tension || '3';
    els.metaTensionValue.textContent = `${els.metaTension.value}/5`;
    els.metaSummary.value = meta.summary || '';
    els.metaParticipants.value = meta.participants || '';
    els.metaKnowledge.value = meta.knowledge || '';
    els.metaInventory.value = meta.inventory || '';
    els.metaGoal.value = meta.goal || '';
    els.metaConflict.value = meta.conflict || '';
    els.metaOutcome.value = meta.outcome || '';
    els.metaNotes.value = meta.notes || '';
  }

  function saveMetadataFromInspector() {
    const scene = activeScene();
    if (!scene) return;
    scene.meta = {
      ...scene.meta,
      pov: els.metaPov.value,
      status: els.metaStatus.value,
      place: els.metaPlace.value,
      date: els.metaDate.value,
      time: els.metaTime.value,
      act: els.metaAct.value,
      tension: els.metaTension.value,
      summary: els.metaSummary.value,
      participants: els.metaParticipants.value,
      knowledge: els.metaKnowledge.value,
      inventory: els.metaInventory.value,
      goal: els.metaGoal.value,
      conflict: els.metaConflict.value,
      outcome: els.metaOutcome.value,
      notes: els.metaNotes.value
    };
    scene.updatedAt = nowIso();
    scheduleSave();
  }

  function updateSceneStats() {
    const text = htmlToText(els.editor.innerHTML);
    const words = countWords(text);
    els.sceneWords.textContent = formatNumber(words);
    els.sceneChars.textContent = formatNumber(text.length);
    els.readTime.textContent = `${Math.max(1, Math.ceil(words / 220))} min`;
    updateSessionWords();
  }

  function updateProjectProgress() {
    const project = activeProject();
    if (!project) return;
    const words = projectWordCount(project);
    const goal = Math.max(1, Number(project.goal) || 80000);
    els.projectWords.textContent = formatNumber(words);
    els.projectGoal.textContent = formatNumber(goal);
    els.projectProgress.value = Math.min(100, Math.round((words / goal) * 100));
  }

  function updatePath() {
    const chapter = activeChapter();
    const scene = activeScene();
    els.currentPath.textContent = chapter && scene ? `${chapter.title} / ${scene.title}` : '';
  }

  function updateSessionWords() {
    const current = projectWordCount(activeProject());
    const delta = current - state.sessionStartWords;
    els.sessionWords.textContent = `Sesión: ${delta >= 0 ? '+' : ''}${formatNumber(delta)} palabras`;
  }

  function projectWordCount(project) {
    if (!project) return 0;
    return project.chapters.reduce((total, chapter) => total + chapter.scenes.reduce((sum, scene) => sum + countWords(htmlToText(scene.html)), 0), 0);
  }

  function selectOutline(type, chapterId, sceneId) {
    stopReadAloud();
    flushEditorToState();
    state.activeChapterId = chapterId;
    const chapter = activeProject().chapters.find(item => item.id === chapterId);
    state.activeSceneId = type === 'scene' ? sceneId : chapter.scenes[0]?.id;
    setView('manuscript');
    renderOutline();
    renderEditor();
    scheduleSave();
    closePanels();
  }

  function switchProject(projectId) {
    stopReadAloud();
    closeSplitEditor();
    flushEditorToState();
    state.activeProjectId = projectId;
    state.activeChapterId = null;
    state.activeSceneId = null;
    state.activeBibleId = null;
    state.splitSceneId = null;
    state.folderHandle = null;
    ensureActiveSelection();
    state.sessionStartWords = projectWordCount(activeProject());
    renderAll();
    persistImmediately();
    loadFolderHandle().then(() => updateFolderStatus());
    state.backupReminderShown = false;
    checkBackupReminder();
    closePanels();
  }

  function addChapter() {
    const project = activeProject();
    const chapter = createChapter(project.chapters.length + 1);
    project.chapters.push(chapter);
    state.activeChapterId = chapter.id;
    state.activeSceneId = chapter.scenes[0].id;
    project.updatedAt = nowIso();
    renderAll();
    scheduleSave();
    els.chapterTitle.focus();
    els.chapterTitle.select();
  }

  function addScene() {
    const chapter = activeChapter();
    if (!chapter) return;
    const scene = createScene(chapter.scenes.length + 1);
    chapter.scenes.push(scene);
    state.activeSceneId = scene.id;
    activeProject().updatedAt = nowIso();
    renderAll();
    scheduleSave();
    els.sceneTitle.focus();
    els.sceneTitle.select();
  }

  function showOutlineMenu(type, chapterId, sceneId) {
    const body = document.createElement('div');
    body.className = 'option-grid';
    const options = type === 'scene'
      ? [
          ['Renombrar', () => renameItem(type, chapterId, sceneId)],
          ['Duplicar', () => duplicateScene(chapterId, sceneId)],
          ['Mover arriba', () => moveScene(chapterId, sceneId, -1)],
          ['Mover abajo', () => moveScene(chapterId, sceneId, 1)],
          ['Eliminar', () => deleteScene(chapterId, sceneId)]
        ]
      : [
          ['Renombrar', () => renameItem(type, chapterId)],
          ['Duplicar', () => duplicateChapter(chapterId)],
          ['Mover arriba', () => moveChapter(chapterId, -1)],
          ['Mover abajo', () => moveChapter(chapterId, 1)],
          ['Eliminar', () => deleteChapter(chapterId)]
        ];
    options.forEach(([label, callback]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => { closeDialog(); callback(); });
      body.append(button);
    });
    openDialog(type === 'scene' ? 'Opciones de escena' : 'Opciones de capítulo', body, []);
  }

  function renameItem(type, chapterId, sceneId) {
    const chapter = activeProject().chapters.find(item => item.id === chapterId);
    const item = type === 'chapter' ? chapter : chapter.scenes.find(scene => scene.id === sceneId);
    const input = document.createElement('input');
    input.value = item.title;
    input.maxLength = 120;
    openDialog('Cambiar título', input, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Guardar', () => {
        item.title = input.value.trim() || item.title;
        renderAll(); scheduleSave(); closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  function duplicateScene(chapterId, sceneId) {
    const chapter = activeProject().chapters.find(item => item.id === chapterId);
    const index = chapter.scenes.findIndex(item => item.id === sceneId);
    const copy = structuredCloneSafe(chapter.scenes[index]);
    copy.id = uid('scene');
    copy.title += ' (copia)';
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    chapter.scenes.splice(index + 1, 0, copy);
    state.activeChapterId = chapterId;
    state.activeSceneId = copy.id;
    renderAll(); scheduleSave();
  }

  function duplicateChapter(chapterId) {
    const project = activeProject();
    const index = project.chapters.findIndex(item => item.id === chapterId);
    const copy = structuredCloneSafe(project.chapters[index]);
    copy.id = uid('chapter');
    copy.title += ' (copia)';
    copy.scenes.forEach(scene => { scene.id = uid('scene'); scene.createdAt = nowIso(); scene.updatedAt = nowIso(); });
    project.chapters.splice(index + 1, 0, copy);
    state.activeChapterId = copy.id;
    state.activeSceneId = copy.scenes[0].id;
    renderAll(); scheduleSave();
  }

  function moveScene(chapterId, sceneId, direction) {
    const chapter = activeProject().chapters.find(item => item.id === chapterId);
    moveArrayItem(chapter.scenes, chapter.scenes.findIndex(item => item.id === sceneId), direction);
    renderOutline(); scheduleSave();
  }

  function moveChapter(chapterId, direction) {
    const project = activeProject();
    moveArrayItem(project.chapters, project.chapters.findIndex(item => item.id === chapterId), direction);
    renderOutline(); scheduleSave();
  }

  function moveArrayItem(array, index, direction) {
    const target = index + direction;
    if (index < 0 || target < 0 || target >= array.length) return;
    [array[index], array[target]] = [array[target], array[index]];
  }

  function deleteScene(chapterId, sceneId) {
    const chapter = activeProject().chapters.find(item => item.id === chapterId);
    if (chapter.scenes.length === 1) {
      toast('Cada capítulo debe conservar al menos una escena.');
      return;
    }
    const index = chapter.scenes.findIndex(item => item.id === sceneId);
    const [scene] = chapter.scenes.splice(index, 1);
    activeProject().trash.unshift({ id: uid('trash'), type: 'scene', parentChapterId: chapterId, deletedAt: nowIso(), data: scene });
    state.activeSceneId = chapter.scenes[Math.max(0, index - 1)].id;
    renderAll(); scheduleSave();
  }

  function deleteChapter(chapterId) {
    const project = activeProject();
    if (project.chapters.length === 1) {
      toast('El proyecto debe conservar al menos un capítulo.');
      return;
    }
    const index = project.chapters.findIndex(item => item.id === chapterId);
    const [chapter] = project.chapters.splice(index, 1);
    project.trash.unshift({ id: uid('trash'), type: 'chapter', deletedAt: nowIso(), data: chapter });
    const next = project.chapters[Math.max(0, index - 1)];
    state.activeChapterId = next.id;
    state.activeSceneId = next.scenes[0].id;
    renderAll(); scheduleSave();
  }

  function renderTrash() {
    const project = activeProject();
    if (!project) return;
    if (!project.trash.length) {
      els.trashList.innerHTML = '<div class="bible-editor empty">La papelera está vacía.</div>';
      return;
    }
    els.trashList.innerHTML = project.trash.map(item => {
      const label = item.type === 'chapter' ? 'Capítulo' : item.type === 'scene' ? 'Escena' : 'Ficha';
      const title = item.data.title || item.data.name || 'Elemento sin nombre';
      return `<div class="trash-item">
      <div><strong>${escapeHtml(title)}</strong><small>${label} · Eliminado ${formatDate(item.deletedAt)}</small></div>
      <div>
        <button type="button" data-trash-restore="${escapeAttr(item.id)}">Recuperar</button>
        <button type="button" class="danger" data-trash-delete="${escapeAttr(item.id)}">Borrar</button>
      </div>
    </div>`; }).join('');
    $$('[data-trash-restore]', els.trashList).forEach(button => button.addEventListener('click', () => restoreTrash(button.dataset.trashRestore)));
    $$('[data-trash-delete]', els.trashList).forEach(button => button.addEventListener('click', () => permanentlyDeleteTrash(button.dataset.trashDelete)));
  }

  function restoreTrash(trashId) {
    const project = activeProject();
    const index = project.trash.findIndex(item => item.id === trashId);
    if (index < 0) return;
    const [item] = project.trash.splice(index, 1);
    if (item.type === 'chapter') {
      project.chapters.push(item.data);
      state.activeChapterId = item.data.id;
      state.activeSceneId = item.data.scenes[0].id;
    } else if (item.type === 'scene') {
      const chapter = project.chapters.find(ch => ch.id === item.parentChapterId) || activeChapter() || project.chapters[0];
      chapter.scenes.push(item.data);
      state.activeChapterId = chapter.id;
      state.activeSceneId = item.data.id;
    } else {
      project.bible.push(item.data);
      state.activeBibleId = item.data.id;
      setView('bible');
    }
    renderAll(); scheduleSave(); toast('Elemento recuperado.');
  }

  function permanentlyDeleteTrash(trashId) {
    const project = activeProject();
    const item = project.trash.find(entry => entry.id === trashId);
    if (!item) return;
    const message = document.createElement('p');
    message.textContent = 'Esta acción no se puede deshacer. El elemento se eliminará definitivamente.';
    openDialog('Borrar definitivamente', message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Borrar definitivamente', () => {
        project.trash = project.trash.filter(entry => entry.id !== trashId);
        renderTrash(); scheduleSave(); closeDialog();
      }, 'danger')
    ]);
  }

  function emptyTrash() {
    if (!activeProject().trash.length) return;
    const message = document.createElement('p');
    message.textContent = 'Esta acción eliminará definitivamente todo el contenido de la papelera.';
    openDialog('Vaciar papelera', message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Vaciar definitivamente', () => {
        activeProject().trash = [];
        renderTrash(); scheduleSave(); closeDialog();
      }, 'danger')
    ]);
  }

  function setView(view) {
    state.view = view;
    $$('.view').forEach(element => element.classList.remove('active-view'));
    $(`#${view}View`)?.classList.add('active-view');
    $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    if (view === 'analysis') renderAnalysis();
    if (view === 'cards') renderCards();
    if (view === 'timeline') renderTimeline();
    if (view === 'clues') renderClues();
    if (view === 'continuity') renderContinuity();
    if (view === 'comments') renderComments();
    if (view === 'trash') renderTrash();
    if (view === 'bible') renderBible();
    if (window.matchMedia('(max-width: 760px)').matches) closePanels();
  }

  function renderBible() {
    const project = activeProject();
    if (!project) return;
    if (!project.bible.length) {
      els.bibleList.innerHTML = '<p class="empty-message">Todavía no hay fichas.</p>';
      els.bibleEditor.className = 'bible-editor empty';
      els.bibleEditor.textContent = 'Crea fichas de personajes, lugares, objetos, pistas o reglas del mundo.';
      return;
    }
    if (!project.bible.some(entry => entry.id === state.activeBibleId)) state.activeBibleId = project.bible[0].id;
    els.bibleList.innerHTML = project.bible.map(entry => `<button type="button" class="bible-item ${entry.id === state.activeBibleId ? 'active' : ''}" data-bible-id="${escapeAttr(entry.id)}">
      <strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.type)}</small>
    </button>`).join('');
    const entry = project.bible.find(item => item.id === state.activeBibleId);
    els.bibleEditor.className = 'bible-editor';
    els.bibleEditor.innerHTML = `<div class="form-grid">
      <label class="full">Nombre<input id="bibleName" maxlength="240" value="${escapeAttr(entry.name)}"></label>
      <label>Tipo<select id="bibleType">${['Personaje','Lugar','Objeto','Organización','Pista','Misterio','Regla del mundo','Glosario','Documentación'].map(type => `<option ${type === entry.type ? 'selected' : ''}>${type}</option>`).join('')}</select></label>
      <label>Etiquetas<input id="bibleTags" maxlength="4000" value="${escapeAttr((entry.tags || []).join(', '))}" placeholder="protagonista, secreto"></label>
      <label class="full">Resumen<textarea id="bibleSummary" maxlength="20000" rows="3">${escapeHtml(entry.summary || '')}</textarea></label>
      <label class="full">Contenido<textarea id="bibleContent" maxlength="200000" rows="14">${escapeHtml(entry.content || '')}</textarea></label>
      <div class="full form-actions"><button type="button" id="deleteBible" class="danger">Eliminar ficha</button></div>
    </div>`;
    ['bibleName','bibleType','bibleTags','bibleSummary','bibleContent'].forEach(id => {
      $(`#${id}`, els.bibleEditor).addEventListener('input', saveBibleEntryFromUI);
    });
    $('#deleteBible', els.bibleEditor).addEventListener('click', deleteBibleEntry);
  }

  function showNewBibleEntryDialog() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Nombre<input id="newBibleName" maxlength="240" placeholder="Nombre de la ficha"></label>
      <label class="full">Tipo<select id="newBibleType"><option>Personaje</option><option>Lugar</option><option>Objeto</option><option>Organización</option><option>Pista</option><option>Misterio</option><option>Regla del mundo</option><option>Glosario</option><option>Documentación</option></select></label>
    </div>`;
    openDialog('Nueva ficha', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Crear', () => {
        const name = $('#newBibleName', wrapper).value.trim() || 'Ficha sin nombre';
        const entry = { id: uid('bible'), name, type: $('#newBibleType', wrapper).value, tags: [], summary: '', content: '', createdAt: nowIso(), updatedAt: nowIso() };
        activeProject().bible.push(entry);
        state.activeBibleId = entry.id;
        renderBible(); scheduleSave(); closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => $('#newBibleName', wrapper).focus(), 0);
  }

  function saveBibleEntryFromUI() {
    const entry = activeProject().bible.find(item => item.id === state.activeBibleId);
    if (!entry) return;
    entry.name = safeString($('#bibleName', els.bibleEditor).value, 240) || 'Ficha sin nombre';
    entry.type = $('#bibleType', els.bibleEditor).value;
    entry.tags = $('#bibleTags', els.bibleEditor).value.split(',').slice(0, 100).map(tag => safeString(tag.trim(), 80)).filter(Boolean);
    entry.summary = safeString($('#bibleSummary', els.bibleEditor).value, 20000);
    entry.content = safeString($('#bibleContent', els.bibleEditor).value, 200000);
    entry.updatedAt = nowIso();
    renderBibleListOnly();
    scheduleSave();
  }

  function renderBibleListOnly() {
    const project = activeProject();
    els.bibleList.innerHTML = project.bible.map(entry => `<button type="button" class="bible-item ${entry.id === state.activeBibleId ? 'active' : ''}" data-bible-id="${escapeAttr(entry.id)}">
      <strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.type)}</small>
    </button>`).join('');
  }

  function deleteBibleEntry() {
    const project = activeProject();
    const entry = project.bible.find(item => item.id === state.activeBibleId);
    if (!entry) return;
    const message = document.createElement('p');
    message.textContent = `La ficha “${entry.name}” se moverá a la papelera.`;
    openDialog('Eliminar ficha', message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Mover a la papelera', () => {
        project.bible = project.bible.filter(item => item.id !== entry.id);
        project.trash.unshift({ id: uid('trash'), type: 'bible', deletedAt: nowIso(), data: entry });
        state.activeBibleId = project.bible[0]?.id || null;
        renderBible(); renderTrash(); scheduleSave(); closeDialog();
      }, 'danger')
    ]);
  }

  function renderAnalysis() {
    const project = activeProject();
    if (!project) return;
    flushEditorToState();
    const allText = project.chapters.flatMap(chapter => chapter.scenes.map(scene => htmlToText(scene.html))).join('\n\n');
    const words = wordTokens(allText);
    const sentences = splitSentences(allText);
    const paragraphs = allText.split(/\n+/).filter(line => line.trim());
    const dialogueChars = (allText.match(/—[^\n]*/g) || []).join('').length;
    const dialoguePct = allText.length ? Math.round((dialogueChars / allText.length) * 100) : 0;
    const scenes = project.chapters.reduce((sum, chapter) => sum + chapter.scenes.length, 0);
    const metrics = [
      [formatNumber(words.length), 'Palabras'],
      [formatNumber(project.chapters.length), 'Capítulos'],
      [formatNumber(scenes), 'Escenas'],
      [`${dialoguePct}%`, 'Diálogo estimado'],
      [sentences.length ? (words.length / sentences.length).toFixed(1) : '0', 'Palabras por frase'],
      [paragraphs.length ? (words.length / paragraphs.length).toFixed(1) : '0', 'Palabras por párrafo'],
      [`${Math.max(1, Math.ceil(words.length / 220))} min`, 'Lectura estimada'],
      [formatNumber((allText.match(/\b\p{L}+mente\b/giu) || []).length), 'Adverbios en -mente']
    ];
    els.analysisCards.innerHTML = metrics.map(([value, label]) => `<div class="analysis-card"><strong>${value}</strong><span>${label}</span></div>`).join('');

    const stop = new Set('a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa ese eso esta este esto fue ha hay la las le les lo los más me mi muy ni no nos o para pero por porque que se sin sobre su sus te tiene todo un una uno y ya'.split(' '));
    const counts = new Map();
    words.map(word => word.toLocaleLowerCase('es')).filter(word => word.length > 3 && !stop.has(word)).forEach(word => counts.set(word, (counts.get(word) || 0) + 1));
    const frequent = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    els.repetitionTable.innerHTML = frequent.length ? `<table><thead><tr><th>Palabra</th><th>Apariciones</th><th>Por 1.000 palabras</th></tr></thead><tbody>${frequent.map(([word, count]) => `<tr><td>${escapeHtml(word)}</td><td>${count}</td><td>${words.length ? ((count / words.length) * 1000).toFixed(1) : '0'}</td></tr>`).join('')}</tbody></table>` : '<p>No hay texto suficiente.</p>';

    const warnings = [];
    const scenesWithoutPov = project.chapters.flatMap(ch => ch.scenes).filter(scene => !scene.meta.pov).length;
    const scenesWithoutConflict = project.chapters.flatMap(ch => ch.scenes).filter(scene => !scene.meta.conflict).length;
    const unresolvedClues = (project.clues || []).filter(clue => clue.status !== 'Resuelta').length + project.bible.filter(entry => ['Pista','Misterio'].includes(entry.type) && !/resuelt|revelad|cerrad/i.test(`${entry.summary} ${entry.content}`)).length;
    const openComments = (project.comments || []).filter(comment => !comment.resolved).length;
    const continuityIssues = continuityConflicts().details.length;
    if (scenesWithoutPov) warnings.push([`${scenesWithoutPov} escenas sin POV definido.`, 'warn']);
    if (scenesWithoutConflict) warnings.push([`${scenesWithoutConflict} escenas sin conflicto anotado.`, 'warn']);
    if (unresolvedClues) warnings.push([`${unresolvedClues} pistas o misterios sin resolución explícita.`, 'warn']);
    if (openComments) warnings.push([`${openComments} comentarios de revisión siguen abiertos.`, 'warn']);
    if (continuityIssues) warnings.push([`${continuityIssues} contradicciones de continuidad solapadas.`, 'warn']);
    const chapterLengths = project.chapters.map(ch => ch.scenes.reduce((sum, scene) => sum + countWords(htmlToText(scene.html)), 0));
    const average = chapterLengths.reduce((a, b) => a + b, 0) / Math.max(1, chapterLengths.length);
    chapterLengths.forEach((length, index) => {
      if (average > 400 && length > average * 1.8) warnings.push([`${project.chapters[index].title} es mucho más largo que la media.`, 'warn']);
      if (average > 400 && length < average * .35) warnings.push([`${project.chapters[index].title} es mucho más corto que la media.`, 'warn']);
    });
    if (!project.snapshots.length) warnings.push(['Todavía no existe ninguna instantánea manual del proyecto.', 'warn']);
    const externalBackup = project.lastFolderSaveAt || project.lastBackupAt;
    const backupAge = externalBackup ? Date.now() - new Date(externalBackup).getTime() : Infinity;
    if (!externalBackup) warnings.push(['Todavía no se ha creado ninguna copia externa .novel404.', 'warn']);
    else if (backupAge > 7 * 24 * 60 * 60 * 1000) warnings.push(['La última copia completa tiene más de siete días.', 'warn']);
    if (!warnings.length) warnings.push(['No se han detectado avisos básicos de estructura.', 'ok']);
    els.healthList.innerHTML = warnings.map(([text, kind]) => `<li class="${kind}">${escapeHtml(text)}</li>`).join('');
  }

  function handleEditorPaste(event) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');
    let content;
    if (html && /<(p|div|em|i|strong|b|br|h[1-3])\b/i.test(html)) {
      content = sanitizePastedHtml(html);
      if (state.preferences.autoTypography) content = normalizeHtmlTypography(content);
      document.execCommand('insertHTML', false, content);
    } else {
      content = plainTextToHtml(state.preferences.autoTypography ? normalizeSpanishTypography(text) : text);
      document.execCommand('insertHTML', false, content);
    }
    els.editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function handleSplitEditorPaste(event) {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');
    let content;
    if (html && /<(p|div|em|i|strong|b|br|h[1-3])\b/i.test(html)) {
      content = sanitizePastedHtml(html);
      if (state.preferences.autoTypography) content = normalizeHtmlTypography(content);
      document.execCommand('insertHTML', false, content);
    } else {
      content = plainTextToHtml(state.preferences.autoTypography ? normalizeSpanishTypography(text) : text);
      document.execCommand('insertHTML', false, content);
    }
    els.splitEditor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function handleSplitEditorShortcuts(event) {
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault(); saveSplitEditor(); flushSave(); toast('Proyecto guardado localmente.');
    }
  }

  function handleEditorShortcuts(event) {
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'r') {
      event.preventDefault(); insertAtCursor('—');
    }
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'l') {
      event.preventDefault(); surroundSelection('«', '»');
    }
    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'p') {
      event.preventDefault(); insertAtCursor('…');
    }
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertHTML', false, '<hr><p><br></p>');
      els.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (event.ctrlKey && event.key.toLowerCase() === 's') {
      event.preventDefault(); flushSave(); toast('Proyecto guardado localmente.');
    }
  }

  function insertAtCursor(text) {
    els.editor.focus();
    if (text === '⁂') document.execCommand('insertHTML', false, '<hr><p><br></p>');
    else document.execCommand('insertText', false, text);
    els.editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function surroundSelection(open, close) {
    els.editor.focus();
    const selection = window.getSelection();
    const selected = selection?.toString() || '';
    document.execCommand('insertText', false, `${open}${selected}${close}`);
    els.editor.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function showNormalizeDialog() {
    flushEditorToState();
    const scene = activeScene();
    const original = htmlToText(scene.html);
    const normalized = normalizeSpanishTypography(original);
    const changes = countTextChanges(original, normalized);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<p>Se han encontrado aproximadamente <strong>${changes}</strong> ajustes tipográficos posibles.</p>
      <fieldset><legend>Incluye</legend>
        <div>• Tres puntos → …</div><div>• Dos guiones → —</div><div>• &lt;&lt;comillas&gt;&gt; → «comillas»</div><div>• Espacios dobles y espacios ante signos</div>
      </fieldset>
      <label>Vista previa<textarea rows="12" readonly>${escapeHtml(normalized.slice(0, 5000))}</textarea></label>`;
    openDialog('Normalizar tipografía española', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Aplicar a esta escena', () => {
        scene.html = normalizeHtmlTypography(scene.html);
        renderEditor(); scheduleSave(); closeDialog(); toast('Tipografía normalizada.');
      }, 'primary'),
      dialogButton('Aplicar a toda la novela', () => {
        activeProject().chapters.forEach(ch => ch.scenes.forEach(sc => { sc.html = normalizeHtmlTypography(sc.html); }));
        renderAll(); scheduleSave(); closeDialog(); toast('Tipografía normalizada en todo el proyecto.');
      })
    ]);
  }

  function showFindDialog() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Buscar<input id="findText" autocomplete="off"></label>
      <label class="full">Reemplazar por<input id="replaceText" autocomplete="off"></label>
      <label class="checkbox-line full"><input id="findCase" type="checkbox"> Distinguir mayúsculas</label>
      <label class="checkbox-line full"><input id="findAllProject" type="checkbox" checked> Buscar en toda la novela</label>
      <div class="full dialog-help" id="findResult"></div>
    </div>`;
    const countMatches = () => {
      const needle = $('#findText', wrapper).value;
      if (!needle) { $('#findResult', wrapper).textContent = ''; return 0; }
      const flags = $('#findCase', wrapper).checked ? 'g' : 'gi';
      const regex = new RegExp(escapeRegex(needle), flags);
      const texts = $('#findAllProject', wrapper).checked
        ? activeProject().chapters.flatMap(ch => ch.scenes.map(sc => htmlToText(sc.html)))
        : [htmlToText(activeScene().html)];
      const count = texts.reduce((sum, text) => sum + (text.match(regex) || []).length, 0);
      $('#findResult', wrapper).textContent = `${count} coincidencias`;
      return count;
    };
    openDialog('Buscar y reemplazar', wrapper, [
      dialogButton('Cerrar', closeDialog, 'ghost'),
      dialogButton('Reemplazar', () => {
        const needle = $('#findText', wrapper).value;
        if (!needle) return;
        const replacement = $('#replaceText', wrapper).value;
        const flags = $('#findCase', wrapper).checked ? 'g' : 'gi';
        const regex = new RegExp(escapeRegex(needle), flags);
        const scenes = $('#findAllProject', wrapper).checked ? activeProject().chapters.flatMap(ch => ch.scenes) : [activeScene()];
        scenes.forEach(scene => {
          const div = document.createElement('div');
          div.innerHTML = scene.html;
          const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) node.nodeValue = node.nodeValue.replace(regex, replacement);
          scene.html = div.innerHTML;
        });
        renderAll(); scheduleSave(); countMatches(); toast('Reemplazo completado.');
      }, 'primary')
    ]);
    ['findText','findCase','findAllProject'].forEach(id => $(`#${id}`, wrapper).addEventListener('input', countMatches));
    setTimeout(() => $('#findText', wrapper).focus(), 0);
  }

  function toggleReadAloud() {
    if (!('speechSynthesis' in window)) {
      toast('Este navegador no ofrece lectura en voz alta.');
      return;
    }
    if (speechSynthesis.speaking) {
      stopReadAloud();
      toast('Lectura detenida.');
      return;
    }
    flushEditorToState();
    const text = htmlToText(activeScene()?.html || '');
    if (!text.trim()) return toast('La escena está vacía.');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeProject()?.language || 'es-ES';
    utterance.rate = 0.95;
    utterance.onend = resetReadAloudButton;
    utterance.onerror = resetReadAloudButton;
    state.speech = utterance;
    const button = $('[data-action="read-aloud"]');
    button?.setAttribute('aria-pressed', 'true');
    button?.setAttribute('aria-label', 'Detener lectura en voz alta');
    if (button) button.textContent = '■ Detener';
    speechSynthesis.speak(utterance);
    toast('Leyendo la escena actual.');
  }

  function stopReadAloud() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
    state.speech = null;
    resetReadAloudButton();
  }

  function resetReadAloudButton() {
    const button = $('[data-action="read-aloud"]');
    button?.setAttribute('aria-pressed', 'false');
    button?.setAttribute('aria-label', 'Leer escena en voz alta');
    if (button) button.textContent = '▶ Leer';
  }

  function showNewProjectDialog() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Título<input id="newProjectTitle" maxlength="240" placeholder="Título de la novela"></label>
      <label>Autor<input id="newProjectAuthor" maxlength="240" value="I. Roig"></label>
      <label>Objetivo de palabras<input id="newProjectGoal" type="number" min="1000" max="5000000" value="80000"></label>
      <label class="full">Género<input id="newProjectGenre" maxlength="240" placeholder="Thriller, misterio, terror…"></label>
    </div>`;
    openDialog('Nueva novela', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Crear proyecto', () => {
        const project = createSampleProject();
        project.title = safeString($('#newProjectTitle', wrapper).value.trim(), 240) || 'Novela sin título';
        project.author = safeString($('#newProjectAuthor', wrapper).value.trim(), 240) || 'I. Roig';
        project.goal = clampNumber($('#newProjectGoal', wrapper).value, 1000, 5000000, 80000);
        project.genre = safeString($('#newProjectGenre', wrapper).value.trim(), 240);
        project.chapters[0].scenes[0].html = '<p></p>';
        state.projects.push(project);
        state.activeProjectId = project.id;
        state.activeChapterId = project.chapters[0].id;
        state.activeSceneId = project.chapters[0].scenes[0].id;
        state.sessionStartWords = 0;
        renderAll(); persistImmediately(); closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => $('#newProjectTitle', wrapper).focus(), 0);
  }

  function showProjectInfoDialog() {
    const project = activeProject();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Título<input id="projectTitleEdit" maxlength="240" value="${escapeAttr(project.title)}"></label>
      <label class="full">Subtítulo<input id="projectSubtitleEdit" maxlength="400" value="${escapeAttr(project.subtitle)}"></label>
      <label>Autor<input id="projectAuthorEdit" maxlength="240" value="${escapeAttr(project.author)}"></label>
      <label>Género<input id="projectGenreEdit" maxlength="240" value="${escapeAttr(project.genre)}"></label>
      <label>Objetivo de palabras<input id="projectGoalEdit" type="number" min="1000" max="5000000" value="${project.goal}"></label>
      <label>Idioma<select id="projectLanguageEdit"><option value="es-ES">Español</option><option value="ca-ES">Catalán</option><option value="en-US">Inglés</option></select></label>
      <label class="full">Sinopsis<textarea id="projectSynopsisEdit" maxlength="20000" rows="6">${escapeHtml(project.synopsis)}</textarea></label>
      <div class="full storage-note"><strong>Seguridad del proyecto</strong><span>${project.snapshots.length} instantánea${project.snapshots.length === 1 ? '' : 's'} · Última copia: ${project.lastBackupAt ? formatDate(project.lastBackupAt) : 'todavía no exportada'}</span></div>
    </div>`;
    $('#projectLanguageEdit', wrapper).value = project.language || 'es-ES';
    openDialog('Datos del proyecto', wrapper, [
      dialogButton('Instantáneas', () => { closeDialog(); showSnapshotsDialog(); }),
      dialogButton('Nueva instantánea', () => { closeDialog(); showCreateSnapshotDialog(); }),
      dialogButton('Eliminar proyecto', () => { closeDialog(); confirmDeleteProject(); }, 'danger'),
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Guardar', () => {
        project.title = safeString($('#projectTitleEdit', wrapper).value.trim(), 240) || project.title;
        project.subtitle = safeString($('#projectSubtitleEdit', wrapper).value.trim(), 400);
        project.author = safeString($('#projectAuthorEdit', wrapper).value.trim(), 240);
        project.genre = safeString($('#projectGenreEdit', wrapper).value.trim(), 240);
        project.goal = clampNumber($('#projectGoalEdit', wrapper).value, 1000, 5000000, 80000);
        project.language = $('#projectLanguageEdit', wrapper).value;
        project.synopsis = safeString($('#projectSynopsisEdit', wrapper).value, 20000);
        project.updatedAt = nowIso();
        renderAll(); scheduleSave(); closeDialog();
      }, 'primary')
    ]);
  }

  function showCreateSnapshotDialog() {
    const wrapper = document.createElement('div');
    const suggested = `Instantánea ${new Date().toLocaleString('es-ES')}`;
    wrapper.innerHTML = `<label>Nombre de la instantánea<input id="snapshotName" maxlength="240" value="${escapeAttr(suggested)}"></label>
      <p class="dialog-help">Guarda capítulos y fichas para poder volver a este punto. Se conservan como máximo diez instantáneas.</p>`;
    openDialog('Crear instantánea', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Crear', () => {
        createSnapshot($('#snapshotName', wrapper).value.trim() || suggested);
        closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => { $('#snapshotName', wrapper).focus(); $('#snapshotName', wrapper).select(); }, 0);
  }

  function trimSnapshots(project) {
    const manual = project.snapshots.filter(snapshot => !snapshot.auto).slice(0, 10);
    const automatic = project.snapshots.filter(snapshot => snapshot.auto).slice(0, 10);
    project.snapshots = [...manual, ...automatic].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function createSnapshot(name) {
    const project = activeProject();
    flushEditorToState();
    project.snapshots.unshift({
      id: uid('snapshot'),
      name: safeString(name, 240) || `Instantánea ${new Date().toLocaleString('es-ES')}`,
      createdAt: nowIso(),
      data: JSON.stringify({
        chapters: project.chapters,
        bible: project.bible,
        clues: project.clues,
        continuity: project.continuity,
        comments: project.comments,
        activeChapterId: state.activeChapterId,
        activeSceneId: state.activeSceneId,
        activeBibleId: state.activeBibleId
      })
    });
    trimSnapshots(project);
    scheduleSave();
    toast('Instantánea creada.');
  }

  function showSnapshotsDialog() {
    const project = activeProject();
    const wrapper = document.createElement('div');
    wrapper.className = 'snapshot-list';
    if (!project.snapshots.length) {
      wrapper.innerHTML = '<p class="empty-message">Todavía no hay instantáneas. Crea una antes de realizar cambios importantes.</p>';
    } else {
      project.snapshots.forEach(snapshot => {
        const row = document.createElement('div');
        row.className = 'snapshot-item';
        row.innerHTML = `<div><strong>${escapeHtml(snapshot.name)}</strong><small>${snapshot.auto ? 'Autocopia · ' : ''}${formatDate(snapshot.createdAt)}</small></div><div class="snapshot-actions"></div>`;
        const actions = $('.snapshot-actions', row);
        actions.append(
          dialogButton('Restaurar', () => { closeDialog(); confirmRestoreSnapshot(snapshot.id); }),
          dialogButton('Borrar', () => { project.snapshots = project.snapshots.filter(item => item.id !== snapshot.id); scheduleSave(); showSnapshotsDialog(); }, 'danger')
        );
        wrapper.append(row);
      });
    }
    openDialog('Instantáneas del proyecto', wrapper, [
      dialogButton('Nueva instantánea', () => { closeDialog(); showCreateSnapshotDialog(); }, 'primary'),
      dialogButton('Cerrar', closeDialog, 'ghost')
    ]);
  }

  function confirmRestoreSnapshot(snapshotId) {
    const project = activeProject();
    const snapshot = project.snapshots.find(item => item.id === snapshotId);
    if (!snapshot) return;
    const message = document.createElement('div');
    message.innerHTML = `<p>Se sustituirán los capítulos y la biblia actuales por <strong>${escapeHtml(snapshot.name)}</strong>.</p><p>Antes de restaurar se creará automáticamente una instantánea de seguridad.</p>`;
    openDialog('Restaurar instantánea', message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Restaurar', () => {
        try {
          createSnapshot('Antes de restaurar instantánea');
          const data = JSON.parse(snapshot.data);
          const restored = migrateProject({ ...project, chapters: data.chapters, bible: data.bible, clues: data.clues, continuity: data.continuity, comments: data.comments, snapshots: project.snapshots, trash: project.trash });
          project.chapters = restored.chapters;
          project.bible = restored.bible;
          project.clues = restored.clues;
          project.continuity = restored.continuity;
          project.comments = restored.comments;
          const selectedChapter = project.chapters.find(chapter => chapter.id === data.activeChapterId) || project.chapters[0];
          const selectedScene = selectedChapter.scenes.find(scene => scene.id === data.activeSceneId) || selectedChapter.scenes[0];
          state.activeChapterId = selectedChapter.id;
          state.activeSceneId = selectedScene.id;
          state.activeBibleId = project.bible.some(entry => entry.id === data.activeBibleId)
            ? data.activeBibleId
            : project.bible[0]?.id || null;
          project.updatedAt = nowIso();
          renderAll(); scheduleSave(); closeDialog(); toast('Instantánea restaurada.');
        } catch (error) {
          console.error(error);
          closeDialog(); toast('No se pudo restaurar la instantánea.');
        }
      }, 'primary')
    ]);
  }

  function confirmDeleteProject() {
    if (state.projects.length === 1) return toast('Debe existir al menos un proyecto.');
    const message = document.createElement('p');
    message.textContent = `Se eliminará “${activeProject().title}” del almacenamiento local. Exporta antes una copia si deseas conservarla.`;
    openDialog('Eliminar proyecto', message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Eliminar', () => {
        state.projects = state.projects.filter(project => project.id !== state.activeProjectId);
        state.activeProjectId = state.projects[0].id;
        state.activeChapterId = null;
        state.activeSceneId = null;
        ensureActiveSelection();
        renderAll(); persistImmediately(); closeDialog();
      }, 'danger')
    ]);
  }

  function showSettingsDialog() {
    const prefs = state.preferences;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label>Tema<select id="settingTheme"><option value="dark">Oscuro</option><option value="light">Claro</option><option value="sepia">Sepia</option></select></label>
      <label>Papel<select id="settingPaper"><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <label class="full">Fuente del editor<select id="settingFont"><option value='Georgia, "Times New Roman", serif'>Georgia</option><option value='"Palatino Linotype", Palatino, serif'>Palatino</option><option value='Arial, sans-serif'>Arial</option><option value='ui-monospace, Consolas, monospace'>Monoespaciada</option></select></label>
      <label>Tamaño<input id="settingSize" type="number" min="14" max="28" value="${prefs.editorSize}"></label>
      <label>Interlineado<input id="settingLine" type="number" min="1.2" max="2.4" step="0.05" value="${prefs.lineHeight}"></label>
      <label>Sangría (em)<input id="settingIndent" type="number" min="0" max="4" step="0.1" value="${prefs.indent}"></label>
      <label class="checkbox-line"><input id="settingAutoTypography" type="checkbox" ${prefs.autoTypography ? 'checked' : ''}> Tipografía automática al pegar</label>
      <label>Autocopia cada<select id="settingAutoBackup"><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option></select></label>
      <label>Aviso sin copia<select id="settingBackupReminder"><option value="1">1 día</option><option value="3">3 días</option><option value="7">7 días</option><option value="14">14 días</option></select></label>
      <div class="full storage-note"><strong>Almacenamiento</strong><span id="storageDetails">Comprobando espacio disponible…</span><button type="button" id="requestPersistence">Proteger datos del navegador</button></div>
    </div>`;
    $('#settingTheme', wrapper).value = prefs.theme;
    $('#settingPaper', wrapper).value = prefs.paper;
    $('#settingFont', wrapper).value = prefs.editorFont;
    $('#settingAutoBackup', wrapper).value = String(prefs.autoBackupMinutes || AUTO_BACKUP_INTERVAL_MINUTES);
    $('#settingBackupReminder', wrapper).value = String(prefs.backupReminderDays || 7);
    $('#requestPersistence', wrapper).addEventListener('click', async () => {
      const granted = await requestPersistentStorage();
      toast(granted ? 'El navegador protegerá mejor los datos locales.' : 'El navegador no ha concedido almacenamiento persistente. Mantén copias .novel404.');
      await updateStorageDetails(wrapper);
    });
    updateStorageDetails(wrapper);
    openDialog('Ajustes', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Guardar', () => {
        state.preferences = {
          theme: $('#settingTheme', wrapper).value,
          paper: $('#settingPaper', wrapper).value,
          editorFont: $('#settingFont', wrapper).value,
          editorSize: clampNumber($('#settingSize', wrapper).value, 14, 28, 19),
          lineHeight: clampNumber($('#settingLine', wrapper).value, 1.2, 2.4, 1.75),
          indent: clampNumber($('#settingIndent', wrapper).value, 0, 4, 1.5),
          autoTypography: $('#settingAutoTypography', wrapper).checked,
          autoBackupMinutes: clampNumber($('#settingAutoBackup', wrapper).value, 5, 60, AUTO_BACKUP_INTERVAL_MINUTES),
          backupReminderDays: clampNumber($('#settingBackupReminder', wrapper).value, 1, 30, 7)
        };
        safeStorage.setItem(PREFS_KEY, JSON.stringify(state.preferences));
        applyPreferences(); startAutoBackups(); closeDialog();
      }, 'primary')
    ]);
  }

  async function updateStorageDetails(root) {
    const target = $('#storageDetails', root);
    const button = $('#requestPersistence', root);
    if (!target) return;
    let persistent = false;
    if (navigator.storage?.persisted) {
      try { persistent = await navigator.storage.persisted(); } catch { persistent = false; }
    }
    let usageText = 'Espacio no disponible';
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        usageText = `${formatBytes(estimate.usage || 0)} usados de aproximadamente ${formatBytes(estimate.quota || 0)}`;
      } catch { /* Información opcional. */ }
    }
    target.textContent = `${state.storageMode === 'indexeddb' ? 'IndexedDB' : 'Modo de compatibilidad'} · ${usageText} · ${persistent ? 'protegido por el navegador' : 'no protegido'}`;
    if (button) {
      button.disabled = persistent || !navigator.storage?.persist;
      button.textContent = persistent ? 'Datos protegidos' : 'Proteger datos del navegador';
    }
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) return false;
    try { return await navigator.storage.persist(); }
    catch { return false; }
  }

  async function updateStorageStatus() {
    if (!els.storageStatus) return;
    let persistent = false;
    if (navigator.storage?.persisted) {
      try { persistent = await navigator.storage.persisted(); } catch { persistent = false; }
    }
    els.storageStatus.textContent = state.storageMode === 'indexeddb'
      ? `Local y privado · IndexedDB${persistent ? ' protegida' : ''}`
      : 'Local y privado · Modo de compatibilidad; exporta copias frecuentes';
  }

  function applyPreferences() {
    document.body.classList.toggle('theme-light', state.preferences.theme === 'light');
    document.body.classList.toggle('theme-sepia', state.preferences.theme === 'sepia');
    document.body.classList.toggle('paper-dark', state.preferences.paper === 'dark');
    document.documentElement.style.setProperty('--editor-font', state.preferences.editorFont);
    document.documentElement.style.setProperty('--editor-size', `${state.preferences.editorSize}px`);
    document.documentElement.style.setProperty('--editor-line', state.preferences.lineHeight);
    document.documentElement.style.setProperty('--indent', `${state.preferences.indent}em`);
  }

  function toggleFocusMode() {
    const active = document.body.classList.toggle('focus-mode');
    const button = $('[data-action="focus"]');
    button?.setAttribute('aria-pressed', String(active));
    button?.setAttribute('aria-label', active ? 'Salir del modo enfoque' : 'Activar modo enfoque');
    if (active) {
      closePanels();
      setView('manuscript');
    }
  }

  function toggleSidebar() {
    const willOpen = !document.body.classList.contains('sidebar-open');
    closePanels();
    document.body.classList.toggle('sidebar-open', willOpen);
    $('[data-action="toggle-sidebar"]')?.setAttribute('aria-expanded', String(willOpen));
  }

  function toggleInspector() {
    if (window.matchMedia('(max-width: 1100px)').matches) {
      const willOpen = !document.body.classList.contains('inspector-open');
      closePanels();
      document.body.classList.toggle('inspector-open', willOpen);
    } else {
      document.body.classList.toggle('inspector-collapsed');
    }
  }

  function closePanels() {
    document.body.classList.remove('sidebar-open', 'inspector-open');
    $('[data-action="toggle-sidebar"]')?.setAttribute('aria-expanded', 'false');
  }

  function showMobileActionsDialog() {
    const body = document.createElement('div');
    body.className = 'option-grid';
    const actions = [
      ['Nueva novela', 'Crea otro proyecto independiente.', showNewProjectDialog],
      ['Importar', 'Pega texto o importa TXT, Markdown, DOCX y copias.', showImportDialog],
      ['Exportar', 'Genera EPUB, DOCX, Markdown, TXT o una copia completa.', showExportDialog],
      ['Carpeta y copia', 'Vincula una carpeta o guarda una copia directa.', showFolderDialog],
      ['Datos del proyecto', 'Edita título, autor, objetivo e instantáneas.', showProjectInfoDialog],
      ['Ajustes', 'Tema, papel, tipografía y almacenamiento.', showSettingsDialog],
      ['Modo enfoque', 'Oculta paneles para escribir sin distracciones.', toggleFocusMode]
    ];
    actions.forEach(([title, description, callback]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'option-card';
      button.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span>`;
      button.addEventListener('click', () => { closeDialog(); callback(); });
      body.append(button);
    });
    openDialog('Acciones', body, [dialogButton('Cerrar', closeDialog, 'ghost')]);
  }

  function showImportDialog() {
    const wrapper = document.createElement('div');
    wrapper.className = 'option-grid';
    const choices = [
      ['Archivo TXT o Markdown', 'Importa texto y puede dividirlo por capítulos.', () => chooseFiles('.txt,.md,.markdown')],
      ['Documento DOCX', 'Extrae títulos, párrafos, cursivas y negritas básicas.', () => chooseFiles('.docx')],
      ['Proyecto Novel 404', 'Restaura una copia .novel404 o .json.', () => chooseFiles('.novel404,.json')],
      ['Pegar manuscrito', 'Pega un texto largo y decide cómo dividirlo.', showPasteManuscriptDialog]
    ];
    choices.forEach(([title, description, callback]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'option-card';
      button.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
      button.addEventListener('click', () => { closeDialog(); callback(); });
      wrapper.append(button);
    });
    openDialog('Importar contenido', wrapper, [dialogButton('Cerrar', closeDialog, 'ghost')]);
  }

  function chooseFiles(accept) {
    els.fileInput.accept = accept;
    els.fileInput.value = '';
    els.fileInput.click();
  }

  function showPasteManuscriptDialog() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<label>Texto del manuscrito<textarea id="pasteManuscript" rows="18" placeholder="Pega aquí uno o varios capítulos…"></textarea></label>
      <label class="checkbox-line"><input id="pasteSplit" type="checkbox" checked> Detectar títulos como “Capítulo 1”, “Prólogo” o “Epílogo”</label>
      <label class="checkbox-line"><input id="pasteNormalize" type="checkbox" checked> Normalizar tipografía española</label>
      <label class="checkbox-line"><input id="pasteNewProject" type="checkbox"> Crear un proyecto nuevo</label>`;
    openDialog('Pegar manuscrito', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Importar', () => {
        let text = $('#pasteManuscript', wrapper).value;
        if (!text.trim()) return;
        if ($('#pasteNormalize', wrapper).checked) text = normalizeSpanishTypography(text);
        importTextManuscript(text, {
          split: $('#pasteSplit', wrapper).checked,
          newProject: $('#pasteNewProject', wrapper).checked,
          sourceName: 'Texto pegado'
        });
        closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => $('#pasteManuscript', wrapper).focus(), 0);
  }

  async function handleFiles() {
    const files = [...els.fileInput.files];
    for (const file of files) {
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error(`El archivo supera el límite de ${formatBytes(MAX_IMPORT_BYTES)}`);
        const extension = file.name.split('.').pop().toLocaleLowerCase('es');
        if (['txt','md','markdown'].includes(extension)) {
          const text = await file.text();
          importTextManuscript(text, { split: true, newProject: false, sourceName: file.name });
        } else if (extension === 'docx') {
          const sections = await extractDocxManuscript(await file.arrayBuffer(), file.name);
          importStructuredManuscript(sections, { newProject: false, sourceName: file.name });
        } else if (['json','novel404'].includes(extension)) {
          const data = JSON.parse(await file.text());
          importProjectBackup(data, file.name);
        } else {
          throw new Error('Formato no compatible');
        }
      } catch (error) {
        console.error(error);
        toast(`No se pudo importar ${file.name}: ${error.message}`);
      }
    }
  }

  function importTextManuscript(text, options) {
    const sections = options.split ? splitIntoChapters(text) : [{ title: options.sourceName || 'Texto importado', text }];
    const structured = sections.map(section => ({ title: section.title, html: plainTextToHtml(section.text.trim()) }));
    importStructuredManuscript(structured, options);
  }

  function importStructuredManuscript(sections, options = {}) {
    const validSections = (Array.isArray(sections) ? sections : []).filter(section => section && (section.html || section.text || section.title));
    if (!validSections.length) throw new Error('No se ha encontrado texto importable');
    let project = activeProject();
    if (options.newProject) {
      project = createSampleProject();
      project.title = safeString((options.sourceName || 'Proyecto importado').replace(/\.[^.]+$/, ''), 240) || 'Proyecto importado';
      project.chapters = [];
      state.projects.push(project);
      state.activeProjectId = project.id;
    } else if (isUntouchedSampleProject(project)) {
      project.chapters = [];
    }
    const importedChapters = validSections.map((section, index) => ({
      id: uid('chapter'),
      title: safeString(section.title, 240) || `Capítulo ${project.chapters.length + index + 1}`,
      notes: '',
      scenes: [{
        id: uid('scene'),
        title: 'Escena 1',
        html: sanitizeEditorHtml(section.html || plainTextToHtml(section.text || '')),
        meta: emptyMeta(),
        createdAt: nowIso(),
        updatedAt: nowIso()
      }]
    }));
    project.chapters.push(...importedChapters);
    state.activeChapterId = importedChapters[0].id;
    state.activeSceneId = importedChapters[0].scenes[0].id;
    project.updatedAt = nowIso();
    renderAll(); persistImmediately();
    toast(`${importedChapters.length} capítulo${importedChapters.length === 1 ? '' : 's'} importado${importedChapters.length === 1 ? '' : 's'}.`);
  }

  function isUntouchedSampleProject(project) {
    if (!project || project.title !== 'Mi nueva novela' || project.chapters.length !== 1 || project.bible.length || project.snapshots.length || project.clues.length || project.continuity.length || project.comments.length) return false;
    const scenes = project.chapters[0].scenes;
    return scenes.length === 1 && /empieza aquí tu historia/i.test(htmlToText(scenes[0].html));
  }

  function importProjectBackup(data, sourceName) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('La copia no contiene un proyecto válido');
    if (data.format && data.format !== 'novel-forge-404') throw new Error('El formato de copia no es compatible');
    const projectData = data.format === 'novel-forge-404' ? data.project : data.project || data;
    if (!projectData || typeof projectData !== 'object') throw new Error('No se ha encontrado el proyecto en la copia');
    const project = rekeyProject(migrateProject(projectData));
    project.title = `${project.title} (importado)`;
    project.updatedAt = nowIso();
    state.projects.push(project);
    state.activeProjectId = project.id;
    state.activeChapterId = project.chapters[0].id;
    state.activeSceneId = project.chapters[0].scenes[0].id;
    state.activeBibleId = project.bible[0]?.id || null;
    renderAll(); persistImmediately(); toast(`Proyecto restaurado desde ${sourceName}.`);
  }

  function rekeyProject(project) {
    project.id = uid('project');
    const chapterIds = new Map();
    const sceneIds = new Map();
    project.chapters.forEach(chapter => {
      const oldChapterId = chapter.id;
      chapter.id = uid('chapter');
      chapterIds.set(oldChapterId, chapter.id);
      chapter.scenes.forEach(scene => {
        const oldSceneId = scene.id;
        scene.id = uid('scene');
        sceneIds.set(oldSceneId, scene.id);
      });
    });
    project.bible.forEach(entry => { entry.id = uid('bible'); });
    project.clues.forEach(clue => {
      clue.id = uid('clue');
      ['seedSceneId','reinforceSceneId','revealSceneId','resolveSceneId'].forEach(key => { clue[key] = sceneIds.get(clue[key]) || ''; });
    });
    project.continuity.forEach(item => {
      item.id = uid('continuity');
      item.fromSceneId = sceneIds.get(item.fromSceneId) || '';
      item.toSceneId = sceneIds.get(item.toSceneId) || '';
    });
    project.comments.forEach(comment => {
      comment.id = uid('comment');
      comment.sceneId = sceneIds.get(comment.sceneId) || '';
    });
    project.trash.forEach(item => {
      item.id = uid('trash');
      if (item.parentChapterId) item.parentChapterId = chapterIds.get(item.parentChapterId) || '';
      if (item.data) {
        item.data.id = uid(item.type === 'chapter' ? 'chapter' : item.type === 'scene' ? 'scene' : 'bible');
        if (item.type === 'chapter') item.data.scenes.forEach(scene => { scene.id = uid('scene'); });
      }
    });
    project.snapshots.forEach(snapshot => {
      snapshot.id = uid('snapshot');
      try {
        const data = JSON.parse(snapshot.data);
        (data.chapters || []).forEach(chapter => {
          chapter.id = chapterIds.get(chapter.id) || chapter.id;
          (chapter.scenes || []).forEach(scene => { scene.id = sceneIds.get(scene.id) || scene.id; });
        });
        (data.clues || []).forEach(clue => ['seedSceneId','reinforceSceneId','revealSceneId','resolveSceneId'].forEach(key => { clue[key] = sceneIds.get(clue[key]) || ''; }));
        (data.continuity || []).forEach(item => { item.fromSceneId = sceneIds.get(item.fromSceneId) || ''; item.toSceneId = sceneIds.get(item.toSceneId) || ''; });
        (data.comments || []).forEach(comment => { comment.sceneId = sceneIds.get(comment.sceneId) || ''; });
        data.activeChapterId = chapterIds.get(data.activeChapterId) || project.chapters[0]?.id || '';
        data.activeSceneId = sceneIds.get(data.activeSceneId) || project.chapters[0]?.scenes[0]?.id || '';
        snapshot.data = JSON.stringify(data);
      } catch { snapshot.data = ''; }
    });
    project.snapshots = project.snapshots.filter(snapshot => snapshot.data);
    return project;
  }

  function splitIntoChapters(text) {
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    const headingRegex = /^(\s*(?:cap[ií]tulo(?:\s+(?:\d+|[ivxlcdm]+))?(?:\s*[:.—-]\s*.*)?|pr[oó]logo(?:\s*[:.—-]\s*.*)?|ep[ií]logo(?:\s*[:.—-]\s*.*)?|parte\s+(?:\d+|[ivxlcdm]+)(?:\s*[:.—-]\s*.*)?))\s*$/gim;
    const matches = [...normalized.matchAll(headingRegex)];
    if (!matches.length) return [{ title: 'Texto importado', text: normalized }];
    const sections = [];
    if (matches[0].index > 0 && normalized.slice(0, matches[0].index).trim()) {
      sections.push({ title: 'Texto inicial', text: normalized.slice(0, matches[0].index).trim() });
    }
    matches.forEach((match, index) => {
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? normalized.length;
      sections.push({ title: titleCaseHeading(match[1].trim()), text: normalized.slice(start, end).trim() });
    });
    return sections;
  }

  function showExportDialog() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="option-grid" id="exportOptions">
      <button type="button" class="option-card" data-export-format="epub"><strong>EPUB 3</strong><span>Libro electrónico con portada tipográfica, índice navegable y capítulos.</span></button>
      <button type="button" class="option-card" data-export-format="docx"><strong>DOCX editorial</strong><span>Documento Word con portada, capítulos, estilos y sangría real.</span></button>
      <button type="button" class="option-card" data-export-format="markdown"><strong>Markdown</strong><span>Un archivo limpio con títulos, metadatos opcionales y texto.</span></button>
      <button type="button" class="option-card" data-export-format="txt"><strong>TXT UTF-8</strong><span>Texto plano compatible con cualquier editor.</span></button>
      <button type="button" class="option-card" data-export-format="backup"><strong>Copia completa</strong><span>Proyecto .novel404 con estructura, fichas, notas y papelera.</span></button>
    </div>`;
    openDialog('Exportar novela', wrapper, [dialogButton('Cerrar', closeDialog, 'ghost')]);
    $$('[data-export-format]', wrapper).forEach(button => button.addEventListener('click', async () => {
      const format = button.dataset.exportFormat;
      closeDialog();
      await exportProject(format);
    }));
  }

  async function exportProject(format) {
    flushSave();
    const project = activeProject();
    const base = safeFilename(project.title || 'novela');
    try {
      if (format === 'txt') {
        downloadBlob(new Blob([buildPlainText(project)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      } else if (format === 'markdown') {
        downloadBlob(new Blob([buildMarkdown(project)], { type: 'text/markdown;charset=utf-8' }), `${base}.md`);
      } else if (format === 'backup') {
        project.lastBackupAt = nowIso();
        const backup = { format: 'novel-forge-404', version: 3, exportedAt: project.lastBackupAt, project };
        downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }), `${base}.novel404`);
        await persistImmediately();
      } else if (format === 'docx') {
        const blob = await buildDocx(project);
        downloadBlob(blob, `${base}.docx`);
      } else if (format === 'epub') {
        const blob = await buildEpub(project);
        downloadBlob(blob, `${base}.epub`);
      }
      toast(`Exportación ${format.toUpperCase()} preparada.`);
    } catch (error) {
      console.error(error);
      toast(`Error al exportar: ${error.message}`);
    }
  }

  function buildPlainText(project) {
    const lines = [];
    lines.push(project.title.toUpperCase());
    if (project.subtitle) lines.push(project.subtitle);
    if (project.author) lines.push(`\n${project.author}`);
    lines.push('\n\f');
    project.chapters.forEach((chapter, chapterIndex) => {
      if (chapterIndex) lines.push('\n\f');
      lines.push(chapter.title.toUpperCase(), '');
      chapter.scenes.forEach((scene, sceneIndex) => {
        if (sceneIndex) lines.push('', '⁂', '');
        lines.push(htmlToText(scene.html).trim());
      });
    });
    return lines.join('\n').replace(/\n{4,}/g, '\n\n\n');
  }

  function buildMarkdown(project) {
    const lines = ['---', `title: "${yamlEscape(project.title)}"`, `author: "${yamlEscape(project.author)}"`, `language: "${yamlEscape(project.language || 'es-ES')}"`, `words: ${projectWordCount(project)}`, '---', '', `# ${project.title}`];
    if (project.subtitle) lines.push('', `## ${project.subtitle}`);
    if (project.author) lines.push('', `**${project.author}**`);
    project.chapters.forEach(chapter => {
      lines.push('', `# ${chapter.title}`, '');
      chapter.scenes.forEach((scene, index) => {
        if (index) lines.push('', '⁂', '');
        const meta = scene.meta;
        const metaParts = [meta.pov && `POV: ${meta.pov}`, meta.place && `Lugar: ${meta.place}`, meta.date && `Fecha: ${meta.date}`, meta.time && `Hora: ${meta.time}`, meta.act && `Acto: ${meta.act}`].filter(Boolean);
        if (metaParts.length) lines.push(`<!-- ${metaParts.join(' · ')} -->`, '');
        lines.push(htmlToMarkdown(scene.html));
      });
    });
    return lines.join('\n').replace(/\n{4,}/g, '\n\n\n');
  }

  async function buildDocx(project) {
    const files = [];
    const created = new Date().toISOString();
    files.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`]);
    files.push(['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`]);
    files.push(['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`]);
    files.push(['word/styles.xml', docxStylesXml()]);
    files.push(['word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`]);
    files.push(['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(project.title)}</dc:title><dc:creator>${xmlEscape(project.author)}</dc:creator><cp:lastModifiedBy>Novel Forge 404</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`]);
    files.push(['docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Novel Forge 404</Application><AppVersion>1.2</AppVersion><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged></Properties>`]);
    files.push(['word/document.xml', buildDocumentXml(project)]);
    return new Blob([createZip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function docxStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/><w:sz w:val="24"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="708"/></w:pPr><w:rPr><w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/><w:sz w:val="24"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="1800" w:after="300"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="ChapterTitle"><w:name w:val="Chapter Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pageBreakBefore/><w:jc w:val="center"/><w:spacing w:before="900" w:after="600"/><w:keepNext/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="NoIndent"><w:name w:val="No Indent"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style>
      <w:style w:type="paragraph" w:styleId="SceneBreak"><w:name w:val="Scene Break"/><w:basedOn w:val="NoIndent"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="240"/></w:pPr></w:style>
    </w:styles>`;
  }

  function buildDocumentXml(project) {
    const body = [];
    body.push(docxParagraph(project.title, 'Title'));
    if (project.subtitle) body.push(docxParagraph(project.subtitle, 'Subtitle'));
    if (project.author) body.push(docxParagraph(project.author, 'Subtitle'));
    body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    project.chapters.forEach(chapter => {
      body.push(docxParagraph(chapter.title, 'ChapterTitle'));
      let firstParagraph = true;
      chapter.scenes.forEach((scene, sceneIndex) => {
        if (sceneIndex) body.push(docxParagraph('⁂', 'SceneBreak'));
        const blocks = htmlToDocxBlocks(scene.html);
        blocks.forEach(block => {
          if (block.type === 'break') body.push(docxParagraph('⁂', 'SceneBreak'));
          else {
            body.push(docxRichParagraph(block.runs, firstParagraph ? 'NoIndent' : 'Normal'));
            firstParagraph = false;
          }
        });
      });
    });
    body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}</w:body></w:document>`;
  }

  function htmlToDocxBlocks(html) {
    const container = document.createElement('div');
    container.innerHTML = sanitizeEditorHtml(html);
    const blocks = [];
    const blockNodes = [...container.childNodes];
    blockNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) blocks.push({ type: 'paragraph', runs: [{ text: node.textContent }] });
      else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'HR' || node.textContent.trim() === '⁂') blocks.push({ type: 'break' });
        else blocks.push({ type: 'paragraph', runs: extractRuns(node) });
      }
    });
    return blocks.length ? blocks : [{ type: 'paragraph', runs: [{ text: '' }] }];
  }

  function extractRuns(root) {
    const runs = [];
    function walk(node, style = {}) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue) runs.push({ text: node.nodeValue, ...style });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      const next = { ...style };
      if (['STRONG','B'].includes(tag)) next.bold = true;
      if (['EM','I'].includes(tag)) next.italic = true;
      if (tag === 'U') next.underline = true;
      if (tag === 'BR') { runs.push({ text: '\n', ...style }); return; }
      node.childNodes.forEach(child => walk(child, next));
    }
    walk(root);
    return runs.length ? runs : [{ text: '' }];
  }

  function docxParagraph(text, style = 'Normal') {
    return docxRichParagraph([{ text }], style);
  }

  function docxRichParagraph(runs, style = 'Normal') {
    const runXml = runs.map(run => {
      const parts = String(run.text).split('\n');
      return parts.map((part, index) => `${index ? '<w:r><w:br/></w:r>' : ''}<w:r>${run.bold || run.italic || run.underline ? `<w:rPr>${run.bold ? '<w:b/>' : ''}${run.italic ? '<w:i/>' : ''}${run.underline ? '<w:u w:val="single"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEscape(part)}</w:t></w:r>`).join('');
    }).join('');
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runXml}</w:p>`;
  }

  function createZip(entries) {
    const encoder = new TextEncoder();
    const files = entries.map(([name, content]) => ({ name, data: content instanceof Uint8Array ? content : encoder.encode(content) }));
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    files.forEach(file => {
      const nameBytes = encoder.encode(file.name);
      const crc = crc32(file.data);
      const local = new Uint8Array(30 + nameBytes.length + file.data.length);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true); view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, file.data.length, true);
      view.setUint32(22, file.data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      local.set(nameBytes, 30); local.set(file.data, 30 + nameBytes.length);
      localParts.push(local);

      const central = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, file.data.length, true); cv.setUint32(24, file.data.length, true);
      cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true); central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length;
    });
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
    return concatBytes([...localParts, ...centralParts, end]);
  }

  async function extractDocxManuscript(buffer, sourceName = 'Documento DOCX') {
    const files = await readZip(new Uint8Array(buffer));
    const documentXml = files.get('word/document.xml');
    if (!documentXml) throw new Error('El archivo DOCX no contiene word/document.xml');
    const xml = new TextDecoder('utf-8').decode(documentXml);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('El XML principal del DOCX está dañado');
    const paragraphs = [...doc.getElementsByTagNameNS('*', 'p')].map(paragraph => {
      const runs = [...paragraph.getElementsByTagNameNS('*', 'r')];
      const html = runs.map(docxRunToHtml).join('');
      const text = runs.map(docxRunToText).join('').replace(/\u00a0/g, ' ').trim();
      return { text, html };
    });

    const sections = [];
    let current = {
      title: safeString(sourceName.replace(/\.[^.]+$/, ''), 240) || 'Documento importado',
      blocks: [],
      texts: []
    };
    let foundHeading = false;
    paragraphs.forEach(paragraph => {
      if (isChapterHeading(paragraph.text)) {
        if (current.blocks.length && (foundHeading || isMeaningfulDocxPreface(current.texts))) {
          sections.push({ title: foundHeading ? current.title : 'Texto inicial', html: current.blocks.join('') });
        }
        current = { title: titleCaseHeading(paragraph.text), blocks: [], texts: [] };
        foundHeading = true;
        return;
      }
      if (!paragraph.text && !paragraph.html) return;
      current.texts.push(paragraph.text);
      if (paragraph.text === '⁂' || /^\*\s*\*\s*\*$/.test(paragraph.text)) current.blocks.push('<hr>');
      else current.blocks.push(`<p>${paragraph.html || escapeHtml(paragraph.text)}</p>`);
    });
    if (current.blocks.length || !sections.length) {
      if (foundHeading || !sections.length || isMeaningfulDocxPreface(current.texts)) {
        sections.push({ title: current.title, html: current.blocks.join('') || '<p></p>' });
      }
    }
    return sections.map(section => ({ title: section.title, html: sanitizeEditorHtml(section.html) }));
  }

  function isMeaningfulDocxPreface(texts) {
    const meaningful = texts.map(text => safeString(text, 2000).trim()).filter(Boolean);
    if (!meaningful.length) return false;
    const totalWords = countWords(meaningful.join(' '));
    if (totalWords >= 35) return true;
    return meaningful.some(text => countWords(text) >= 12 && /[.!?…][»”']?$/.test(text));
  }

  function docxRunToText(run) {
    let text = '';
    [...run.childNodes].forEach(child => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const name = child.localName;
      if (name === 't' || name === 'instrText') text += child.textContent || '';
      else if (name === 'tab') text += '\t';
      else if (name === 'br' || name === 'cr') text += '\n';
    });
    return text;
  }

  function docxRunToHtml(run) {
    const raw = docxRunToText(run);
    if (!raw) return '';
    let html = escapeHtml(raw).replace(/\t/g, '&emsp;').replace(/\n/g, '<br>');
    const properties = run.getElementsByTagNameNS('*', 'rPr')[0];
    if (properties) {
      if (properties.getElementsByTagNameNS('*', 'u').length) html = `<u>${html}</u>`;
      if (properties.getElementsByTagNameNS('*', 'i').length) html = `<em>${html}</em>`;
      if (properties.getElementsByTagNameNS('*', 'b').length) html = `<strong>${html}</strong>`;
    }
    return html;
  }

  function isChapterHeading(text) {
    return /^\s*(?:cap[ií]tulo(?:\s+(?:\d+|[ivxlcdm]+|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo))?(?:\s*[:.—-]\s*.*)?|pr[oó]logo(?:\s*[:.—-]\s*.*)?|ep[ií]logo(?:\s*[:.—-]\s*.*)?|parte\s+(?:\d+|[ivxlcdm]+)(?:\s*[:.—-]\s*.*)?)\s*$/i.test(text || '');
  }

  async function readZip(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 22) throw new Error('ZIP no válido');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP no válido');
    const entries = view.getUint16(eocd + 10, true);
    if (entries > 5000) throw new Error('El ZIP contiene demasiados archivos');
    let offset = view.getUint32(eocd + 16, true);
    if (offset < 0 || offset >= bytes.length) throw new Error('Directorio ZIP fuera de rango');
    const files = new Map();
    let totalUncompressed = 0;
    for (let i = 0; i < entries; i++) {
      if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Directorio ZIP dañado');
      const flags = view.getUint16(offset + 8, true);
      if (flags & 0x0001) throw new Error('Los DOCX cifrados no son compatibles');
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      if (uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw new Error('El DOCX contiene una entrada demasiado grande');
      totalUncompressed += uncompressedSize;
      if (totalUncompressed > MAX_ZIP_TOTAL_BYTES) throw new Error('El DOCX descomprimido es demasiado grande');
      const nameStart = offset + 46;
      const nameEnd = nameStart + nameLength;
      if (nameEnd > bytes.length) throw new Error('Nombre de archivo ZIP fuera de rango');
      const name = new TextDecoder().decode(bytes.slice(nameStart, nameEnd));
      if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) throw new Error('Ruta insegura dentro del ZIP');
      if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Cabecera local ZIP dañada');
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataStart < 0 || dataEnd > bytes.length) throw new Error('Datos ZIP fuera de rango');
      const compressed = bytes.slice(dataStart, dataEnd);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed, uncompressedSize);
      else throw new Error(`Método ZIP no compatible: ${method}`);
      if (data.length > MAX_ZIP_ENTRY_BYTES) throw new Error('Una entrada descomprimida supera el límite permitido');
      files.set(name, data);
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  async function inflateRaw(bytes, expectedSize = 0) {
    if (!('DecompressionStream' in window)) throw new Error('Este navegador no permite importar DOCX comprimidos. Prueba con Chrome, Edge, Firefox o Safari actualizado.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    if (expectedSize && data.length !== expectedSize) throw new Error('El DOCX contiene una entrada con tamaño incoherente');
    return data;
  }

  function flattenScenes(project = activeProject()) {
    if (!project) return [];
    const result = [];
    project.chapters.forEach((chapter, chapterIndex) => {
      chapter.scenes.forEach((scene, sceneIndex) => {
        result.push({ chapter, scene, chapterIndex, sceneIndex, order: result.length });
      });
    });
    return result;
  }

  function findSceneContext(sceneId, project = activeProject()) {
    return flattenScenes(project).find(item => item.scene.id === sceneId) || null;
  }

  function sceneLabel(sceneId, project = activeProject()) {
    const context = findSceneContext(sceneId, project);
    return context ? `${context.chapter.title} · ${context.scene.title}` : 'Sin asignar';
  }

  function sceneOptions(selectedId = '', includeBlank = true) {
    const options = flattenScenes().map(({ chapter, scene }) =>
      `<option value="${escapeAttr(scene.id)}" ${scene.id === selectedId ? 'selected' : ''}>${escapeHtml(chapter.title)} · ${escapeHtml(scene.title)}</option>`
    ).join('');
    return `${includeBlank ? `<option value="" ${selectedId ? '' : 'selected'}>Sin asignar</option>` : ''}${options}`;
  }

  function openSceneById(sceneId) {
    const context = findSceneContext(sceneId);
    if (!context) return toast('La escena ya no está disponible.');
    flushEditorToState();
    state.activeChapterId = context.chapter.id;
    state.activeSceneId = context.scene.id;
    setView('manuscript');
    renderOutline();
    renderEditor();
    scheduleSave();
    setTimeout(() => els.editor?.focus(), 0);
  }

  function statusColor(status) {
    const colors = {
      Idea: '#8f9aad', Borrador: '#d19a66', Escrito: '#61afef',
      'Revisión estructural': '#c678dd', 'Revisión de estilo': '#b995ff',
      Corrección: '#e5c07b', Final: '#75d7a5', Bloqueado: '#ff7d8a'
    };
    return colors[status] || 'var(--accent)';
  }

  function renderCards() {
    if (!els.cardsBoard) return;
    const project = activeProject();
    if (!project) return;
    els.cardsBoard.innerHTML = project.chapters.map(chapter => {
      const words = chapter.scenes.reduce((sum, scene) => sum + countWords(htmlToText(scene.html)), 0);
      const cards = chapter.scenes.map(scene => {
        const text = (scene.meta.summary || htmlToText(scene.html)).trim();
        const metadata = [scene.meta.pov && `POV: ${scene.meta.pov}`, scene.meta.place, scene.meta.date, `Tensión ${scene.meta.tension || 3}/5`].filter(Boolean);
        return `<button type="button" class="scene-card" draggable="true" data-card-scene="${escapeAttr(scene.id)}" data-card-chapter="${escapeAttr(chapter.id)}" style="--status-color:${statusColor(scene.meta.status)}">
          <strong>${escapeHtml(scene.title)}</strong>
          <p>${escapeHtml(text || 'Escena todavía sin resumen ni texto.')}</p>
          <span class="card-meta">${metadata.map(item => `<span class="meta-chip">${escapeHtml(item)}</span>`).join('')}</span>
          <span class="card-footer"><span>${escapeHtml(scene.meta.status || 'Idea')}</span><span>${formatNumber(countWords(htmlToText(scene.html)))} palabras</span></span>
        </button>`;
      }).join('');
      return `<section class="card-column" data-drop-chapter="${escapeAttr(chapter.id)}">
        <div class="card-column-header"><h2>${escapeHtml(chapter.title)}</h2><span>${chapter.scenes.length} escenas · ${formatNumber(words)} palabras</span></div>
        ${cards}
      </section>`;
    }).join('');

    $$('[data-card-scene]', els.cardsBoard).forEach(card => {
      card.addEventListener('click', () => openSceneById(card.dataset.cardScene));
      card.addEventListener('dragstart', event => {
        state.draggedScene = { sceneId: card.dataset.cardScene, chapterId: card.dataset.cardChapter };
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.dataset.cardScene);
      });
      card.addEventListener('dragend', () => {
        state.draggedScene = null;
        card.classList.remove('dragging');
        $$('.card-column', els.cardsBoard).forEach(column => column.classList.remove('drag-over'));
      });
    });
    $$('[data-drop-chapter]', els.cardsBoard).forEach(column => {
      column.addEventListener('dragover', event => {
        event.preventDefault();
        column.classList.add('drag-over');
        event.dataTransfer.dropEffect = 'move';
      });
      column.addEventListener('dragleave', event => {
        if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over');
      });
      column.addEventListener('drop', event => {
        event.preventDefault();
        column.classList.remove('drag-over');
        const sceneId = state.draggedScene?.sceneId || event.dataTransfer.getData('text/plain');
        if (sceneId) moveSceneToChapter(sceneId, column.dataset.dropChapter);
      });
    });
  }

  function moveSceneToChapter(sceneId, targetChapterId) {
    const project = activeProject();
    const sourceChapter = project.chapters.find(chapter => chapter.scenes.some(scene => scene.id === sceneId));
    const targetChapter = project.chapters.find(chapter => chapter.id === targetChapterId);
    if (!sourceChapter || !targetChapter) return;
    if (sourceChapter.id !== targetChapter.id && sourceChapter.scenes.length === 1) {
      return toast('No se puede dejar un capítulo sin escenas. Añade otra escena antes de moverla.');
    }
    const sourceIndex = sourceChapter.scenes.findIndex(scene => scene.id === sceneId);
    const [scene] = sourceChapter.scenes.splice(sourceIndex, 1);
    targetChapter.scenes.push(scene);
    state.activeChapterId = targetChapter.id;
    state.activeSceneId = scene.id;
    project.updatedAt = nowIso();
    renderAll();
    scheduleSave();
    toast(`Escena movida a ${targetChapter.title}.`);
  }

  function timelineTimestamp(scene) {
    if (!scene.meta.date) return null;
    const date = new Date(`${scene.meta.date}T${scene.meta.time || '00:00'}:00`);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function sceneCharacters(scene) {
    return [...new Set([scene.meta.pov, ...(scene.meta.participants || '').split(/[,;\n]/)]
      .map(value => value.trim().toLocaleLowerCase('es')).filter(Boolean))];
  }

  function timelineConflicts(items) {
    const conflicts = [];
    const groups = new Map();
    items.filter(item => item.timestamp !== null).forEach(item => {
      const key = String(item.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    groups.forEach(group => {
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const shared = sceneCharacters(group[i].scene).filter(name => sceneCharacters(group[j].scene).includes(name));
          if (shared.length && group[i].scene.meta.place && group[j].scene.meta.place && group[i].scene.meta.place.toLocaleLowerCase('es') !== group[j].scene.meta.place.toLocaleLowerCase('es')) {
            conflicts.push({ a: group[i], b: group[j], characters: shared });
          }
        }
      }
    });
    return conflicts;
  }

  function renderTimeline() {
    if (!els.timelineList || !els.timelineSummary) return;
    const items = flattenScenes().map(context => ({ ...context, timestamp: timelineTimestamp(context.scene) }));
    const dated = items.filter(item => item.timestamp !== null).sort((a, b) => a.timestamp - b.timestamp || a.order - b.order);
    const missing = items.filter(item => item.timestamp === null);
    const ordered = [...dated, ...missing];
    const conflicts = timelineConflicts(items);
    els.timelineSummary.innerHTML = [
      `<span class="summary-pill">${dated.length} escenas fechadas</span>`,
      `<span class="summary-pill ${missing.length ? 'warn' : ''}">${missing.length} sin fecha</span>`,
      `<span class="summary-pill ${conflicts.length ? 'warn' : ''}">${conflicts.length} coincidencias por revisar</span>`
    ].join('');
    if (!ordered.length) {
      els.timelineList.innerHTML = '<p class="empty-message">No hay escenas.</p>';
      return;
    }
    els.timelineList.innerHTML = ordered.map(item => {
      const { scene, chapter } = item;
      const dateText = item.timestamp === null
        ? 'Fecha sin definir'
        : new Date(item.timestamp).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: scene.meta.time ? 'short' : undefined });
      const summary = scene.meta.summary || htmlToText(scene.html).slice(0, 260) || 'Escena sin contenido.';
      return `<button type="button" class="timeline-item ${item.timestamp === null ? 'missing-date' : ''}" data-timeline-scene="${escapeAttr(scene.id)}">
        <span class="timeline-date"><strong>${escapeHtml(dateText)}</strong><br>${escapeHtml(scene.meta.place || 'Lugar sin definir')}</span>
        <span class="timeline-content"><h2>${escapeHtml(chapter.title)} · ${escapeHtml(scene.title)}</h2><p>${escapeHtml(summary)}</p><span class="card-meta"><span class="meta-chip">POV: ${escapeHtml(scene.meta.pov || 'sin definir')}</span><span class="meta-chip">Tensión ${escapeHtml(scene.meta.tension || '3')}/5</span></span></span>
      </button>`;
    }).join('');
    $$('[data-timeline-scene]', els.timelineList).forEach(button => button.addEventListener('click', () => openSceneById(button.dataset.timelineScene)));
    if (conflicts.length) {
      const warning = document.createElement('div');
      warning.className = 'planning-health';
      warning.innerHTML = `<strong>Posibles conflictos simultáneos</strong>${conflicts.slice(0, 10).map(conflict => `<span class="backup-warning">${escapeHtml(conflict.characters.join(', '))}: ${escapeHtml(sceneLabel(conflict.a.scene.id))} y ${escapeHtml(sceneLabel(conflict.b.scene.id))} ocurren a la misma hora en lugares distintos.</span>`).join('')}`;
      els.timelineList.prepend(warning);
    }
  }

  function clueStageIndex(status) {
    return ['Idea', 'Sembrada', 'Reforzada', 'Revelada', 'Resuelta'].indexOf(status);
  }

  function renderClues() {
    if (!els.cluesList || !els.clueHealth) return;
    const project = activeProject();
    const clues = project.clues || [];
    const warnings = clues.filter(clue => clueStageIndex(clue.status) >= 3 && !clue.seedSceneId).length;
    const unresolved = clues.filter(clue => clue.status !== 'Resuelta').length;
    els.clueHealth.innerHTML = `<div class="health-strip"><span class="summary-pill">${clues.length} pistas</span><span class="summary-pill ${unresolved ? 'warn' : ''}">${unresolved} pendientes</span><span class="summary-pill ${warnings ? 'warn' : ''}">${warnings} revelaciones sin siembra</span></div>`;
    if (!clues.length) {
      els.cluesList.innerHTML = '<div class="bible-editor empty">Todavía no hay pistas. Registra la primera para controlar su recorrido narrativo.</div>';
      return;
    }
    els.cluesList.innerHTML = clues.map(clue => {
      const current = clueStageIndex(clue.status);
      const firstScene = clue.resolveSceneId || clue.revealSceneId || clue.seedSceneId;
      return `<article class="planning-item ${current >= 3 && !clue.seedSceneId ? 'conflict-item' : ''}">
        <div><h2>${escapeHtml(clue.title)}</h2><p>${escapeHtml(clue.description || 'Sin descripción.')}</p>
          <div class="status-track">${['Idea','Sembrada','Reforzada','Revelada','Resuelta'].map((stage, index) => `<span class="status-step ${index <= current ? 'done' : ''}">${stage}</span>`).join('')}</div>
          <small>Siembra: ${escapeHtml(sceneLabel(clue.seedSceneId))} · Revelación: ${escapeHtml(sceneLabel(clue.revealSceneId))} · Resolución: ${escapeHtml(sceneLabel(clue.resolveSceneId))}</small>
          ${clue.knownBy ? `<small>La conocen: ${escapeHtml(clue.knownBy)}</small>` : ''}
        </div>
        <div class="planning-actions">${firstScene ? `<button type="button" data-clue-open="${escapeAttr(firstScene)}">Abrir escena</button>` : ''}<button type="button" data-clue-edit="${escapeAttr(clue.id)}">Editar</button><button type="button" class="danger" data-clue-delete="${escapeAttr(clue.id)}">Eliminar</button></div>
      </article>`;
    }).join('');
    $$('[data-clue-open]', els.cluesList).forEach(button => button.addEventListener('click', () => openSceneById(button.dataset.clueOpen)));
    $$('[data-clue-edit]', els.cluesList).forEach(button => button.addEventListener('click', () => showClueDialog(button.dataset.clueEdit)));
    $$('[data-clue-delete]', els.cluesList).forEach(button => button.addEventListener('click', () => deletePlanningItem('clue', button.dataset.clueDelete)));
  }

  function showClueDialog(clueId = '') {
    const project = activeProject();
    const existing = project.clues.find(item => item.id === clueId);
    const clue = existing || sanitizeClue({});
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Título<input id="clueTitle" maxlength="240" value="${escapeAttr(clue.title === 'Pista sin título' && !existing ? '' : clue.title)}" placeholder="La llave con la marca roja"></label>
      <label>Estado<select id="clueStatus">${['Idea','Sembrada','Reforzada','Revelada','Resuelta'].map(status => `<option ${status === clue.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
      <label>Personajes que la conocen<input id="clueKnown" maxlength="5000" value="${escapeAttr(clue.knownBy)}"></label>
      <label class="full">Descripción<textarea id="clueDescription" maxlength="30000" rows="3">${escapeHtml(clue.description)}</textarea></label>
      <label>Escena de siembra<select id="clueSeed">${sceneOptions(clue.seedSceneId)}</select></label>
      <label>Escena de refuerzo<select id="clueReinforce">${sceneOptions(clue.reinforceSceneId)}</select></label>
      <label>Escena de revelación<select id="clueReveal">${sceneOptions(clue.revealSceneId)}</select></label>
      <label>Escena de resolución<select id="clueResolve">${sceneOptions(clue.resolveSceneId)}</select></label>
      <label class="full">Interpretación falsa<textarea id="clueFalse" maxlength="10000" rows="2">${escapeHtml(clue.falseMeaning)}</textarea></label>
      <label class="full">Notas<textarea id="clueNotes" maxlength="30000" rows="3">${escapeHtml(clue.notes)}</textarea></label>
    </div>`;
    openDialog(existing ? 'Editar pista' : 'Nueva pista', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton(existing ? 'Guardar' : 'Crear pista', () => {
        const saved = sanitizeClue({
          ...clue,
          title: $('#clueTitle', wrapper).value.trim() || 'Pista sin título',
          status: $('#clueStatus', wrapper).value,
          knownBy: $('#clueKnown', wrapper).value,
          description: $('#clueDescription', wrapper).value,
          seedSceneId: $('#clueSeed', wrapper).value,
          reinforceSceneId: $('#clueReinforce', wrapper).value,
          revealSceneId: $('#clueReveal', wrapper).value,
          resolveSceneId: $('#clueResolve', wrapper).value,
          falseMeaning: $('#clueFalse', wrapper).value,
          notes: $('#clueNotes', wrapper).value,
          updatedAt: nowIso()
        });
        if (existing) Object.assign(existing, saved); else project.clues.push(saved);
        project.updatedAt = nowIso();
        renderClues(); scheduleSave(); closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => $('#clueTitle', wrapper).focus(), 0);
  }

  function continuityInterval(item, orderMap) {
    const start = orderMap.get(item.fromSceneId);
    if (start === undefined) return null;
    const endValue = orderMap.get(item.toSceneId);
    const end = endValue === undefined ? start : endValue;
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  function continuityConflicts() {
    const items = activeProject().continuity || [];
    const orderMap = new Map(flattenScenes().map((item, index) => [item.scene.id, index]));
    const conflictIds = new Set();
    const details = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]; const b = items[j];
        if (a.entity.trim().toLocaleLowerCase('es') !== b.entity.trim().toLocaleLowerCase('es')) continue;
        if (a.attribute.trim().toLocaleLowerCase('es') !== b.attribute.trim().toLocaleLowerCase('es')) continue;
        if (a.value.trim().toLocaleLowerCase('es') === b.value.trim().toLocaleLowerCase('es')) continue;
        const ai = continuityInterval(a, orderMap); const bi = continuityInterval(b, orderMap);
        if (!ai || !bi || ai.end < bi.start || bi.end < ai.start) continue;
        conflictIds.add(a.id); conflictIds.add(b.id);
        details.push(`${a.entity} · ${a.attribute}: “${a.value}” / “${b.value}”`);
      }
    }
    return { conflictIds, details };
  }

  function renderContinuity() {
    if (!els.continuityList || !els.continuityHealth) return;
    const project = activeProject();
    const entries = project.continuity || [];
    const conflicts = continuityConflicts();
    els.continuityHealth.innerHTML = `<div class="health-strip"><span class="summary-pill">${entries.length} hechos</span><span class="summary-pill ${conflicts.details.length ? 'warn' : ''}">${conflicts.details.length} solapamientos contradictorios</span></div>${conflicts.details.slice(0, 5).map(text => `<span class="conflict-label">${escapeHtml(text)}</span>`).join('')}`;
    if (!entries.length) {
      els.continuityList.innerHTML = '<div class="bible-editor empty">Registra estados de personajes, objetos, heridas, localizaciones o conocimientos para comprobar su continuidad.</div>';
      return;
    }
    els.continuityList.innerHTML = entries.map(item => `<article class="planning-item ${conflicts.conflictIds.has(item.id) ? 'conflict-item' : ''}">
      <div><h2>${escapeHtml(item.entity)} · ${escapeHtml(item.attribute)}</h2><p><strong>${escapeHtml(item.value || 'Sin valor')}</strong></p><small>${escapeHtml(item.category)} · Desde ${escapeHtml(sceneLabel(item.fromSceneId))}${item.toSceneId ? ` hasta ${escapeHtml(sceneLabel(item.toSceneId))}` : ''}</small>${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ''}</div>
      <div class="planning-actions">${item.fromSceneId ? `<button type="button" data-continuity-open="${escapeAttr(item.fromSceneId)}">Abrir escena</button>` : ''}<button type="button" data-continuity-edit="${escapeAttr(item.id)}">Editar</button><button type="button" class="danger" data-continuity-delete="${escapeAttr(item.id)}">Eliminar</button></div>
    </article>`).join('');
    $$('[data-continuity-open]', els.continuityList).forEach(button => button.addEventListener('click', () => openSceneById(button.dataset.continuityOpen)));
    $$('[data-continuity-edit]', els.continuityList).forEach(button => button.addEventListener('click', () => showContinuityDialog(button.dataset.continuityEdit)));
    $$('[data-continuity-delete]', els.continuityList).forEach(button => button.addEventListener('click', () => deletePlanningItem('continuity', button.dataset.continuityDelete)));
  }

  function showContinuityDialog(itemId = '') {
    const project = activeProject();
    const existing = project.continuity.find(item => item.id === itemId);
    const item = existing || sanitizeContinuity({ fromSceneId: state.activeSceneId });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label>Entidad<input id="continuityEntity" maxlength="240" value="${escapeAttr(item.entity === 'Elemento sin nombre' && !existing ? '' : item.entity)}" placeholder="Mara"></label>
      <label>Categoría<select id="continuityCategory">${['Personaje','Ubicación','Objeto','Herida','Ropa','Relación','Conocimiento','Cronología','Otro'].map(category => `<option ${category === item.category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>
      <label>Atributo<input id="continuityAttribute" maxlength="240" value="${escapeAttr(item.attribute)}" placeholder="Herida en la mano"></label>
      <label>Valor<input id="continuityValue" maxlength="10000" value="${escapeAttr(item.value)}" placeholder="Vendaje limpio"></label>
      <label>Desde la escena<select id="continuityFrom">${sceneOptions(item.fromSceneId, false)}</select></label>
      <label>Hasta la escena<select id="continuityTo">${sceneOptions(item.toSceneId)}</select></label>
      <label class="full">Notas<textarea id="continuityNotes" maxlength="30000" rows="4">${escapeHtml(item.notes)}</textarea></label>
    </div>`;
    openDialog(existing ? 'Editar continuidad' : 'Nuevo hecho de continuidad', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton(existing ? 'Guardar' : 'Crear hecho', () => {
        const saved = sanitizeContinuity({ ...item,
          entity: $('#continuityEntity', wrapper).value.trim() || 'Elemento sin nombre',
          category: $('#continuityCategory', wrapper).value,
          attribute: $('#continuityAttribute', wrapper).value.trim() || 'Estado',
          value: $('#continuityValue', wrapper).value,
          fromSceneId: $('#continuityFrom', wrapper).value,
          toSceneId: $('#continuityTo', wrapper).value,
          notes: $('#continuityNotes', wrapper).value,
          updatedAt: nowIso()
        });
        if (existing) Object.assign(existing, saved); else project.continuity.push(saved);
        project.updatedAt = nowIso();
        renderContinuity(); scheduleSave(); closeDialog();
      }, 'primary')
    ]);
    setTimeout(() => $('#continuityEntity', wrapper).focus(), 0);
  }

  function deletePlanningItem(type, id) {
    const project = activeProject();
    const label = type === 'clue' ? 'pista' : 'hecho de continuidad';
    const message = document.createElement('p');
    message.textContent = `Se eliminará este ${label}. Esta acción no afecta al manuscrito.`;
    openDialog(`Eliminar ${label}`, message, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Eliminar', () => {
        if (type === 'clue') project.clues = project.clues.filter(item => item.id !== id);
        else project.continuity = project.continuity.filter(item => item.id !== id);
        renderClues(); renderContinuity(); scheduleSave(); closeDialog();
      }, 'danger')
    ]);
  }

  function selectedTextContext() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return { text: '', sceneId: state.activeSceneId };
    const range = selection.getRangeAt(0);
    const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (els.splitEditor?.contains(node)) return { text: selection.toString().trim(), sceneId: state.splitSceneId };
    if (els.editor?.contains(node)) return { text: selection.toString().trim(), sceneId: state.activeSceneId };
    return { text: '', sceneId: state.activeSceneId };
  }

  function showAddCommentDialog() {
    const project = activeProject();
    const selection = selectedTextContext();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<div class="form-grid">
      <label class="full">Escena<select id="commentScene">${sceneOptions(selection.sceneId, false)}</select></label>
      <label>Tipo<select id="commentType"><option>Revisión</option><option>Continuidad</option><option>Estilo</option><option>Investigación</option><option>Duda</option><option>Lector beta</option></select></label>
      <label class="full">Fragmento<textarea id="commentExcerpt" maxlength="5000" rows="3" placeholder="Opcional: texto al que se refiere">${escapeHtml(selection.text)}</textarea></label>
      <label class="full">Comentario<textarea id="commentNote" maxlength="30000" rows="6" placeholder="Qué quieres revisar o recordar"></textarea></label>
    </div>`;
    openDialog('Añadir comentario', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Guardar comentario', () => {
        const note = $('#commentNote', wrapper).value.trim();
        if (!note) return toast('Escribe el comentario antes de guardarlo.');
        project.comments.unshift(sanitizeComment({
          sceneId: $('#commentScene', wrapper).value,
          excerpt: $('#commentExcerpt', wrapper).value,
          note,
          type: $('#commentType', wrapper).value,
          resolved: false
        }));
        project.updatedAt = nowIso();
        renderComments(); scheduleSave(); closeDialog(); toast('Comentario añadido.');
      }, 'primary')
    ]);
    setTimeout(() => $('#commentNote', wrapper).focus(), 0);
  }

  function renderComments() {
    if (!els.commentsList || !els.commentsFilters) return;
    const project = activeProject();
    const comments = project.comments || [];
    const openCount = comments.filter(comment => !comment.resolved).length;
    if (els.commentBadge) {
      els.commentBadge.textContent = String(openCount);
      els.commentBadge.hidden = openCount === 0;
    }
    els.commentsFilters.innerHTML = `<span>${openCount} abiertos · ${comments.length - openCount} resueltos</span><label>Mostrar<select id="commentFilter"><option value="open">Pendientes</option><option value="all">Todos</option><option value="resolved">Resueltos</option></select></label>`;
    $('#commentFilter', els.commentsFilters).value = state.commentFilter;
    $('#commentFilter', els.commentsFilters).addEventListener('change', event => { state.commentFilter = event.target.value; renderComments(); });
    const filtered = comments.filter(comment => state.commentFilter === 'all' || (state.commentFilter === 'resolved' ? comment.resolved : !comment.resolved));
    if (!filtered.length) {
      els.commentsList.innerHTML = '<div class="bible-editor empty">No hay comentarios en este filtro.</div>';
      return;
    }
    els.commentsList.innerHTML = filtered.map(comment => `<article class="planning-item ${comment.resolved ? 'comment-resolved' : ''}">
      <div><h2>${escapeHtml(comment.type)} · ${escapeHtml(sceneLabel(comment.sceneId))}</h2><p>${escapeHtml(comment.note)}</p>${comment.excerpt ? `<blockquote class="comment-quote">${escapeHtml(comment.excerpt)}</blockquote>` : ''}<small>${formatDate(comment.createdAt)}${comment.resolved ? ' · Resuelto' : ''}</small></div>
      <div class="planning-actions"><button type="button" data-comment-open="${escapeAttr(comment.sceneId)}">Abrir escena</button><button type="button" data-comment-toggle="${escapeAttr(comment.id)}">${comment.resolved ? 'Reabrir' : 'Resolver'}</button><button type="button" class="danger" data-comment-delete="${escapeAttr(comment.id)}">Eliminar</button></div>
    </article>`).join('');
    $$('[data-comment-open]', els.commentsList).forEach(button => button.addEventListener('click', () => openSceneById(button.dataset.commentOpen)));
    $$('[data-comment-toggle]', els.commentsList).forEach(button => button.addEventListener('click', () => {
      const comment = project.comments.find(item => item.id === button.dataset.commentToggle);
      if (!comment) return;
      comment.resolved = !comment.resolved; comment.updatedAt = nowIso(); renderComments(); scheduleSave();
    }));
    $$('[data-comment-delete]', els.commentsList).forEach(button => button.addEventListener('click', () => {
      project.comments = project.comments.filter(item => item.id !== button.dataset.commentDelete); renderComments(); scheduleSave();
    }));
  }

  function showCompareVersionsDialog() {
    const project = activeProject();
    if (!project.snapshots.length) {
      const message = document.createElement('div');
      message.innerHTML = '<p>No hay versiones históricas. Crea una instantánea antes de reescribir para poder comparar cambios.</p>';
      return openDialog('Comparar versiones', message, [dialogButton('Crear instantánea', () => { closeDialog(); showCreateSnapshotDialog(); }, 'primary'), dialogButton('Cerrar', closeDialog, 'ghost')]);
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<label>Comparar la escena actual con<select id="compareSnapshot">${project.snapshots.map(snapshot => `<option value="${escapeAttr(snapshot.id)}">${escapeHtml(snapshot.name)} · ${escapeHtml(formatDate(snapshot.createdAt))}</option>`).join('')}</select></label><p class="dialog-help">La comparación se hace línea por línea con la escena que tenía el mismo identificador en esa instantánea.</p>`;
    openDialog('Comparar versiones', wrapper, [
      dialogButton('Cancelar', closeDialog, 'ghost'),
      dialogButton('Comparar', () => {
        const snapshot = project.snapshots.find(item => item.id === $('#compareSnapshot', wrapper).value);
        closeDialog();
        showSnapshotDiff(snapshot);
      }, 'primary')
    ]);
  }

  function snapshotSceneText(snapshot, sceneId) {
    try {
      const data = JSON.parse(snapshot.data);
      for (const chapter of data.chapters || []) {
        const scene = (chapter.scenes || []).find(item => item.id === sceneId);
        if (scene) return htmlToText(scene.html || '');
      }
    } catch { /* Instantánea dañada; se informa abajo. */ }
    return null;
  }

  function lineDiff(before, after) {
    const a = before.split(/\r?\n/).slice(0, 400);
    const b = after.split(/\r?\n/).slice(0, 400);
    const rows = a.length + 1;
    const cols = b.length + 1;
    if (rows * cols > 90000) {
      const max = Math.max(a.length, b.length);
      return Array.from({ length: max }, (_, index) => ({ left: a[index] ?? '', right: b[index] ?? '', leftType: a[index] === b[index] ? 'same' : 'removed', rightType: a[index] === b[index] ? 'same' : 'added' }));
    }
    const dp = Array.from({ length: rows }, () => new Uint16Array(cols));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const result = [];
    let i = 0; let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) { result.push({ left: a[i], right: b[j], leftType: 'same', rightType: 'same' }); i++; j++; }
      else if (i < a.length && (j >= b.length || dp[i + 1][j] >= dp[i][j + 1])) { result.push({ left: a[i], right: '', leftType: 'removed', rightType: 'same' }); i++; }
      else { result.push({ left: '', right: b[j], leftType: 'same', rightType: 'added' }); j++; }
    }
    return result;
  }

  function showSnapshotDiff(snapshot) {
    if (!snapshot) return toast('No se ha encontrado la instantánea.');
    flushEditorToState();
    const before = snapshotSceneText(snapshot, state.activeSceneId);
    if (before === null) return toast('La escena actual no existía en esa instantánea.');
    const after = htmlToText(activeScene().html || '');
    const rows = lineDiff(before, after);
    const wrapper = document.createElement('div');
    wrapper.className = 'diff-layout';
    wrapper.innerHTML = `<section class="diff-pane"><h3>${escapeHtml(snapshot.name)}</h3><div class="diff-content">${rows.map(row => `<span class="diff-line ${row.leftType}">${escapeHtml(row.left || ' ')}</span>`).join('')}</div></section><section class="diff-pane"><h3>Versión actual</h3><div class="diff-content">${rows.map(row => `<span class="diff-line ${row.rightType}">${escapeHtml(row.right || ' ')}</span>`).join('')}</div></section>`;
    openDialog('Comparación de la escena', wrapper, [dialogButton('Cerrar', closeDialog, 'primary')]);
  }

  function toggleSplitEditor() {
    const opening = els.splitPane.hidden;
    if (!opening) return closeSplitEditor();
    const scenes = flattenScenes();
    if (scenes.length < 2) return toast('Añade otra escena para utilizar el editor dividido.');
    const candidate = scenes.find(item => item.scene.id !== state.activeSceneId);
    state.splitSceneId = state.splitSceneId && state.splitSceneId !== state.activeSceneId ? state.splitSceneId : candidate.scene.id;
    els.splitPane.hidden = false;
    els.editorSplitShell.classList.add('is-split');
    $('[data-action="toggle-split"]')?.setAttribute('aria-pressed', 'true');
    renderSplitEditor();
  }

  function closeSplitEditor() {
    if (!els.splitPane) return;
    saveSplitEditor();
    els.splitPane.hidden = true;
    els.editorSplitShell.classList.remove('is-split');
    $('[data-action="toggle-split"]')?.setAttribute('aria-pressed', 'false');
  }

  function renderSplitEditor() {
    if (!els.splitPane || els.splitPane.hidden) return;
    const scenes = flattenScenes();
    if (!scenes.length) return closeSplitEditor();
    if (!state.splitSceneId || state.splitSceneId === state.activeSceneId || !findSceneContext(state.splitSceneId)) {
      state.splitSceneId = scenes.find(item => item.scene.id !== state.activeSceneId)?.scene.id || scenes[0].scene.id;
    }
    els.splitSceneSelect.innerHTML = scenes.map(({ chapter, scene }) => `<option value="${escapeAttr(scene.id)}" ${scene.id === state.splitSceneId ? 'selected' : ''}>${escapeHtml(chapter.title)} · ${escapeHtml(scene.title)}</option>`).join('');
    const context = findSceneContext(state.splitSceneId);
    if (!context) return;
    els.splitSceneTitle.value = context.scene.title;
    els.splitEditor.innerHTML = context.scene.html || '<p></p>';
  }

  function saveSplitEditor() {
    if (!els.splitPane || els.splitPane.hidden || !state.splitSceneId) return;
    const context = findSceneContext(state.splitSceneId);
    if (!context) return;
    context.scene.html = sanitizeEditorHtml(els.splitEditor.innerHTML);
    context.scene.updatedAt = nowIso();
    activeProject().updatedAt = nowIso();
    updateProjectProgress();
    scheduleSave();
  }

  function saveSplitTitle() {
    const context = findSceneContext(state.splitSceneId);
    if (!context) return;
    context.scene.title = els.splitSceneTitle.value.trim() || 'Escena sin título';
    renderOutline();
    scheduleSave();
  }

  async function loadFolderHandle() {
    state.folderHandle = null;
    if (!state.activeProjectId || state.storageMode !== 'indexeddb') return;
    try { state.folderHandle = await databaseGet(`${FOLDER_HANDLE_PREFIX}${state.activeProjectId}`) || null; }
    catch { state.folderHandle = null; }
  }

  async function folderPermission(handle, request = false) {
    if (!handle) return false;
    const options = { mode: 'readwrite' };
    try {
      if (await handle.queryPermission(options) === 'granted') return true;
      if (request && await handle.requestPermission(options) === 'granted') return true;
    } catch { return false; }
    return false;
  }

  async function linkProjectFolder() {
    if (!('showDirectoryPicker' in window)) return toast('Este navegador no permite vincular carpetas. Puedes seguir exportando copias manualmente.');
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'novel-forge-projects' });
      if (!await folderPermission(handle, true)) return toast('No se concedió permiso de escritura.');
      state.folderHandle = handle;
      await databaseSet(`${FOLDER_HANDLE_PREFIX}${state.activeProjectId}`, handle);
      updateFolderStatus();
      toast(`Carpeta “${handle.name}” vinculada.`);
    } catch (error) {
      if (error.name !== 'AbortError') { console.error(error); toast('No se pudo vincular la carpeta.'); }
    }
  }

  async function unlinkProjectFolder() {
    state.folderHandle = null;
    try { await databaseSet(`${FOLDER_HANDLE_PREFIX}${state.activeProjectId}`, null); } catch { /* Opcional */ }
    updateFolderStatus();
    toast('Carpeta desvinculada. Los archivos existentes no se han borrado.');
  }

  function backupPayload(project) {
    return { format: 'novel-forge-404', version: 3, exportedAt: nowIso(), project: structuredCloneSafe(project) };
  }

  async function writeFolderFile(filename, content) {
    if (!state.folderHandle) throw new Error('No hay una carpeta vinculada');
    if (!await folderPermission(state.folderHandle, false)) throw new Error('La carpeta necesita permiso de escritura');
    const fileHandle = await state.folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function saveBackupToLinkedFolder() {
    if (!state.folderHandle) return showFolderDialog();
    try {
      flushEditorToState();
      const project = activeProject();
      const filename = `${safeFilename(project.title)}.novel404`;
      await writeFolderFile(filename, JSON.stringify(backupPayload(project), null, 2));
      project.lastFolderSaveAt = nowIso();
      project.lastBackupAt = project.lastFolderSaveAt;
      await persistImmediately();
      updateFolderStatus();
      toast(`Copia guardada en ${state.folderHandle.name}/${filename}.`);
    } catch (error) {
      console.error(error);
      if (/permiso/i.test(error.message)) showFolderDialog(); else toast(`No se pudo guardar la copia: ${error.message}`);
    }
  }

  function showFolderDialog() {
    const supported = 'showDirectoryPicker' in window;
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-card';
    wrapper.innerHTML = `<strong>${state.folderHandle ? `Carpeta vinculada: ${escapeHtml(state.folderHandle.name)}` : 'Ninguna carpeta vinculada'}</strong><span>${supported ? 'Chrome y Edge pueden guardar copias directamente. En otros navegadores sigue disponible la exportación manual.' : 'Este navegador no ofrece acceso directo a carpetas. Usa la copia .novel404 desde Exportar.'}</span><span>Último guardado externo: ${activeProject().lastFolderSaveAt || activeProject().lastBackupAt ? escapeHtml(formatDate(activeProject().lastFolderSaveAt || activeProject().lastBackupAt)) : 'todavía no realizado'}</span><div class="folder-actions" id="folderActions"></div>`;
    const actions = $('#folderActions', wrapper);
    if (supported) actions.append(dialogButton(state.folderHandle ? 'Cambiar carpeta' : 'Vincular carpeta', async () => { await linkProjectFolder(); closeDialog(); }, 'primary'));
    if (state.folderHandle) {
      actions.append(dialogButton('Guardar copia ahora', async () => { closeDialog(); await saveBackupToLinkedFolder(); }));
      actions.append(dialogButton('Desvincular', async () => { await unlinkProjectFolder(); closeDialog(); }, 'danger'));
    }
    openDialog('Carpeta y copias directas', wrapper, [dialogButton('Cerrar', closeDialog, 'ghost')]);
  }

  function updateFolderStatus() {
    if (!els.folderStatus) return;
    els.folderStatus.textContent = state.folderHandle ? `Carpeta: ${state.folderHandle.name}` : 'Carpeta: no vinculada';
  }

  function startAutoBackups() {
    if (state.autoBackupTimer) clearInterval(state.autoBackupTimer);
    const minutes = clampNumber(state.preferences.autoBackupMinutes, 5, 60, AUTO_BACKUP_INTERVAL_MINUTES);
    state.autoBackupTimer = setInterval(performAutoBackup, minutes * 60 * 1000);
  }

  async function performAutoBackup() {
    const project = activeProject();
    if (!project) return;
    flushEditorToState();
    const last = project.lastAutoBackupAt ? new Date(project.lastAutoBackupAt).getTime() : 0;
    const updated = project.updatedAt ? new Date(project.updatedAt).getTime() : Date.now();
    if (updated <= last) return;
    project.snapshots.unshift({
      id: uid('snapshot'),
      name: `Autocopia ${new Date().toLocaleString('es-ES')}`,
      auto: true,
      createdAt: nowIso(),
      data: JSON.stringify({ chapters: project.chapters, bible: project.bible, clues: project.clues, continuity: project.continuity, comments: project.comments, activeChapterId: state.activeChapterId, activeSceneId: state.activeSceneId, activeBibleId: state.activeBibleId })
    });
    trimSnapshots(project);
    project.lastAutoBackupAt = nowIso();
    if (state.folderHandle && await folderPermission(state.folderHandle, false)) {
      try {
        await writeFolderFile(`${safeFilename(project.title)}.autocopia.novel404`, JSON.stringify(backupPayload(project), null, 2));
        project.lastFolderSaveAt = nowIso();
      } catch (error) { console.warn('La autocopia en carpeta no se pudo completar.', error); }
    }
    await persistImmediately();
    updateFolderStatus();
  }

  function checkBackupReminder() {
    const project = activeProject();
    if (!project || state.backupReminderShown) return;
    const last = project.lastFolderSaveAt || project.lastBackupAt;
    const ageDays = last ? (Date.now() - new Date(last).getTime()) / 86400000 : Infinity;
    const limit = clampNumber(state.preferences.backupReminderDays, 1, 30, 7);
    if (ageDays >= limit) {
      state.backupReminderShown = true;
      setTimeout(() => toast(last ? `Han pasado ${Math.floor(ageDays)} días desde la última copia externa.` : 'Todavía no existe una copia externa del proyecto. Exporta un archivo .novel404.'), 500);
    }
  }

  async function buildEpub(project) {
    const identifier = `urn:novelforge:${project.id.replace(/[^a-zA-Z0-9._-]/g, '') || uid('book')}`;
    const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const chapterFiles = project.chapters.map((chapter, index) => {
      const body = chapter.scenes.map((scene, sceneIndex) => `${sceneIndex ? '<div class="scene-break">⁂</div>' : ''}${epubHtmlFragment(scene.html)}`).join('\n');
      return [`OEBPS/chapter-${index + 1}.xhtml`, `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${xmlEscape(project.language || 'es')}"><head><title>${xmlEscape(chapter.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${xmlEscape(chapter.title)}</h1>${body}</body></html>`];
    });
    const manifestChapters = project.chapters.map((chapter, index) => `<item id="chapter-${index + 1}" href="chapter-${index + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('');
    const spine = project.chapters.map((chapter, index) => `<itemref idref="chapter-${index + 1}"/>`).join('');
    const navItems = project.chapters.map((chapter, index) => `<li><a href="chapter-${index + 1}.xhtml">${xmlEscape(chapter.title)}</a></li>`).join('');
    const files = [
      ['mimetype', 'application/epub+zip'],
      ['META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
      ['OEBPS/style.css', `body{font-family:serif;line-height:1.55;margin:5%;}h1{text-align:center;margin:18% 0 8%;page-break-before:always;}p{margin:0;text-indent:1.5em;}h1+p,h2+p,.no-indent{text-indent:0}.scene-break{text-align:center;margin:1.8em 0;}blockquote{margin:1em 2em;font-style:italic}`],
      ['OEBPS/cover.xhtml', `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${xmlEscape(project.language || 'es')}"><head><title>Portada</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><section style="text-align:center;margin-top:30%"><h1 style="page-break-before:auto">${xmlEscape(project.title)}</h1>${project.subtitle ? `<p class="no-indent">${xmlEscape(project.subtitle)}</p>` : ''}<p class="no-indent">${xmlEscape(project.author || '')}</p></section></body></html>`],
      ['OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${xmlEscape(project.language || 'es')}"><head><title>Índice</title></head><body><nav epub:type="toc"><h1>Índice</h1><ol>${navItems}</ol></nav></body></html>`],
      ['OEBPS/package.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${xmlEscape(project.language || 'es')}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${xmlEscape(identifier)}</dc:identifier><dc:title>${xmlEscape(project.title)}</dc:title><dc:creator>${xmlEscape(project.author || '')}</dc:creator><dc:language>${xmlEscape(project.language || 'es-ES')}</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="style" href="style.css" media-type="text/css"/>${manifestChapters}</manifest><spine><itemref idref="cover" linear="yes"/>${spine}</spine></package>`],
      ...chapterFiles
    ];
    return new Blob([createZip(files)], { type: 'application/epub+zip' });
  }

  function epubHtmlFragment(html) {
    const clean = sanitizeEditorHtml(html || '<p></p>')
      .replace(/&nbsp;/gi, '&#160;')
      .replace(/<br\s*>/gi, '<br />')
      .replace(/<hr\s*>/gi, '<hr />');
    return clean || '<p></p>';
  }


  function scheduleSave() {
    els.saveState.textContent = 'Guardando…';
    els.saveState.className = 'save-state saving';
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => { void persistImmediately(); }, 500);
  }

  function flushSave() {
    flushEditorToState();
    clearTimeout(state.saveTimer);
    void persistImmediately();
  }

  function flushEditorToState() {
    const scene = activeScene();
    if (scene && state.view === 'manuscript') scene.html = sanitizeEditorHtml(els.editor.innerHTML);
  }

  function persistImmediately() {
    flushEditorToState();
    clearTimeout(state.saveTimer);
    const snapshot = structuredCloneSafe(state.projects);
    state.saveChain = state.saveChain.catch(() => undefined).then(async () => {
      let persisted = false;
      if (state.storageMode === 'indexeddb') {
        try {
          await databaseSet(DB_PROJECTS_KEY, snapshot);
          persisted = true;
        } catch (error) {
          console.warn('Falló el guardado en IndexedDB; se intentará localStorage.', error);
          state.storageMode = 'localstorage';
        }
      }
      if (!persisted) {
        persisted = safeStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(snapshot));
      }
      safeStorage.setItem(ACTIVE_KEY, state.activeProjectId || '');
      if (!persisted) throw new Error('El navegador no ha podido persistir el proyecto');
      els.saveState.textContent = 'Guardado';
      els.saveState.className = 'save-state saved';
      setTimeout(() => els.saveState.classList.remove('saved'), 1200);
      updateStorageStatus();
    }).catch(error => {
      console.error(error);
      els.saveState.textContent = 'Error al guardar';
      els.saveState.className = 'save-state error';
      if (!state.storageWarningShown) {
        state.storageWarningShown = true;
        toast('No se ha podido guardar de forma persistente. Exporta ahora una copia .novel404.');
      }
    });
    return state.saveChain;
  }

  function openDialog(title, body, actions = []) {
    if (!els.dialog.open) {
      state.dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    els.dialogTitle.textContent = title;
    els.dialogBody.replaceChildren(body);
    els.dialogActions.replaceChildren(...actions);
    if (!els.dialog.open) els.dialog.showModal();
    const focusTarget = els.dialogBody.querySelector('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')
      || els.dialogActions.querySelector('button')
      || els.dialog.querySelector('[data-action="close-dialog"]');
    requestAnimationFrame(() => focusTarget?.focus());
  }

  function closeDialog() {
    if (els.dialog.open) els.dialog.close();
    else restoreDialogFocus();
  }

  function restoreDialogFocus() {
    const returnFocus = state.dialogReturnFocus;
    state.dialogReturnFocus = null;
    if (returnFocus?.isConnected) requestAnimationFrame(() => returnFocus.focus());
  }

  function dialogButton(label, callback, className = '') {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label; button.className = className;
    button.addEventListener('click', callback);
    return button;
  }

  function toast(message) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    els.toastRegion.append(element);
    setTimeout(() => element.remove(), 4200);
  }

  function normalizeSpanishTypography(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/\.\.\./g, '…')
      .replace(/<<\s*/g, '«')
      .replace(/\s*>>/g, '»')
      .replace(/--/g, '—')
      .replace(/ {2,}/g, ' ')
      .replace(/[ \t]+([,.;:!?…])/g, '$1')
      .replace(/([¿¡])\s+/g, '$1')
      .replace(/\n{3,}/g, '\n\n');
  }

  function normalizeHtmlTypography(html) {
    const container = document.createElement('div');
    container.innerHTML = sanitizeEditorHtml(html);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) node.nodeValue = normalizeSpanishTypography(node.nodeValue);
    return sanitizeEditorHtml(container.innerHTML);
  }

  function plainTextToHtml(text) {
    return text.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(block => {
      const clean = block.trim();
      if (!clean) return '';
      if (clean === '⁂' || /^\*\s*\*\s*\*$/.test(clean)) return '<hr>';
      return `<p>${escapeHtml(clean).replace(/\n/g, '<br>')}</p>`;
    }).join('') || '<p></p>';
  }

  function sanitizePastedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const allowed = new Set(['P','DIV','BR','STRONG','B','EM','I','U','H1','H2','H3','HR']);
    const dangerous = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','LINK','META','SVG','MATH','FORM','INPUT','BUTTON','TEXTAREA','SELECT','OPTION']);
    function clean(node) {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === Node.COMMENT_NODE) child.remove();
        else if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = child.tagName.toUpperCase();
          if (dangerous.has(tagName)) {
            child.remove();
            return;
          }
          clean(child);
          if (!allowed.has(tagName)) child.replaceWith(...child.childNodes);
          else [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
        }
      });
    }
    clean(doc.body);
    return doc.body.innerHTML;
  }

  function sanitizeEditorHtml(html) {
    return sanitizePastedHtml(html || '<p></p>');
  }

  function htmlToText(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    div.querySelectorAll('p,div,h1,h2,h3,hr').forEach(block => {
      if (block.tagName === 'HR') block.replaceWith('\n⁂\n');
      else block.append('\n');
    });
    return (div.textContent || '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }

  function htmlToMarkdown(html) {
    const div = document.createElement('div');
    div.innerHTML = sanitizeEditorHtml(html);
    div.querySelectorAll('strong,b').forEach(el => el.replaceWith(`**${el.textContent}**`));
    div.querySelectorAll('em,i').forEach(el => el.replaceWith(`*${el.textContent}*`));
    div.querySelectorAll('hr').forEach(el => el.replaceWith('\n⁂\n'));
    div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    div.querySelectorAll('p,div,h1,h2,h3').forEach(el => el.append('\n\n'));
    return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function wordTokens(text) {
    return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  }
  function countWords(text) { return wordTokens(text).length; }
  function splitSentences(text) { return text.split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡])/).filter(item => item.trim()); }
  function formatNumber(number) { return Number(number || 0).toLocaleString('es-ES'); }
  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; }
    return `${size.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${units[index]}`;
  }
  function formatDate(value) { return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }); }
  function titleCaseHeading(text) { return text.charAt(0).toLocaleUpperCase('es') + text.slice(1); }
  function safeFilename(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'novela'; }
  function yamlEscape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' '); }
  function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
  function escapeAttr(value) { return escapeHtml(value); }
  function xmlEscape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char])); }
  function countTextChanges(a, b) { let changes = Math.abs(a.length - b.length); const len = Math.min(a.length, b.length); for (let i = 0; i < len; i++) if (a[i] !== b[i]) changes++; return changes; }
  function structuredCloneSafe(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }

  function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach(part => { output.set(part, offset); offset += part.length; });
    return output;
  }

  let crcTable;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker no registrado:', error));
    }
  }
})();
