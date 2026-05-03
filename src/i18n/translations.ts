export type Locale = 'en' | 'es'

export const translations = {
  en: {
    // App
    appName: 'Hoard',

    // Sidebar
    vaults: 'Vaults',
    folders: 'Folders',
    allItems: 'All items',
    noFolders: 'No folders yet',
    tags: 'Tags',
    noTags: 'No tags yet',
    settings: 'Settings',

    // Topbar
    searchPlaceholder: 'Search…',
    add: 'Add',
    resultsFor: 'results for',

    // Empty states
    emptyHoard: 'Every hoard starts with one treasure.',
    addFirstItem: 'Add your first item',
    noResults: 'No items match your search.',

    // Item types
    link: 'Link',
    note: 'Note',
    image: 'Image',
    code: 'Code',

    // Add modal
    addToHoard: 'Add to Hoard',
    urlPlaceholder: 'https://…',
    fetch: 'Fetch',
    titleOptional: 'Title (optional)',
    writeNote: 'Write your note… (Markdown supported)',
    descriptionOptional: 'Description (optional)',
    clickToPickImage: 'Click to pick an image',
    clickToChange: 'Click to change',
    shortcutSave: '⌘ + Enter to save',
    cancel: 'Cancel',
    save: 'Save',
    codePlaceholder: 'Paste your code here…',
    codeLanguage: 'Language',

    // Vault modal
    newVaultTitle: 'New vault',
    editVaultTitle: 'Edit vault',
    vaultNamePlaceholder: 'Vault name',
    color: 'Color',
    create: 'Create',

    // Folder modal
    newFolderTitle: 'New folder',
    folderNamePlaceholder: 'Folder name',
    parentFolderLabel: 'Parent folder (optional)',
    noParent: 'Root (no parent)',

    // Tags
    tagsLabel: 'Tags',
    addTagPlaceholder: 'Add tag…',
    createTag: 'Create',
    tagNamePlaceholder: 'Tag name',
    pickColor: 'Pick a color',

    // Settings
    settingsTitle: 'Settings',
    settingsGeneral: 'General',
    settingsAppearance: 'Appearance',
    settingsData: 'Data',
    settingsLanguage: 'Language',
    settingsShowReadingTime: 'Show reading time',
    settingsDefaultType: 'Default item type',
    settingsCompactView: 'Compact view',
    settingsDataLocation: 'Data location',
    settingsOpenFolder: 'Open data folder',
    settingsLanguageEn: 'English',
    settingsLanguageEs: 'Español',
    settingsLaunchAtStartup: 'Launch Hoard on system startup',

    // Confirmations
    deleteVaultConfirm: (name: string) =>
      `Delete vault "${name}"? All its content will be lost.`,
    deleteFolderConfirm: (name: string) =>
      `Delete folder "${name}" and all its items?`,
    deleteItemConfirm: 'Delete this item?',
    deleteTagConfirm: 'Delete this tag from all items?',

    // Card actions
    pinItem: 'Pin',
    unpinItem: 'Unpin',
    deleteItem: 'Delete',
    openLink: 'Open link',
    loading: 'Loading…',

    // Preview panel
    openInBrowser: 'Open in browser',
    readingTimeMin: (n: number) => `${n} min read`,
    closePreview: 'Close preview',
    noDescription: 'No description.',
    copyCode: 'Copy',
    codeCopied: 'Copied!',

    // Archive status
    archivePending: 'Archiving…',
    archiveDone: 'Page archived',
    archiveFailed: 'Archive failed',

    // Multi-select
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    selected: (n: number) => `${n} selected`,
    moveOrCopy: 'Move / Copy',
    deleteSelected: (n: number) => `Delete ${n} items?`,

    // Folder update
    updateFolder: 'Update folder',

    // Confirm dialog
    confirmDelete: 'Delete',

    // Toast messages
    toastItemAdded:    'Item added',
    toastItemDeleted:  'Item deleted',
    toastItemPinned:   'Item pinned',
    toastItemUnpinned: 'Item unpinned',
    toastVaultCreated: 'Vault created',
    toastFolderCreated:'Folder created',
    toastUrlCopied:    'URL copied',
    toastTagDeleted:   'Tag deleted',
    toastVaultDeleted: 'Vault deleted',
    toastFolderDeleted:'Folder deleted',
    toastItemMoved:    'Item moved',
    toastItemCopied:   'Item copied',

    // Sort
    sortLabel:    'Sort',
    sortNewest:   'Newest first',
    sortOldest:   'Oldest first',
    sortTitleAz:  'Title A → Z',
    sortTitleZa:  'Title Z → A',

    // Context menu
    copyUrl: 'Copy URL',

    // Command palette
    cmdPlaceholder:  'Search items, vaults, folders…',
    cmdNoResults:    'No results',
    cmdActionsLabel: 'Actions',
    cmdItemsLabel:   'Items',
    cmdOpenSettings: 'Open Settings',
    cmdNewItem:      'New item',
    cmdLockApp:      'Lock app',

    // Inline rename
    renamePlaceholder: 'Rename…',

    // Edit item modal
    editItem:          'Edit item',
    toastItemUpdated:  'Item updated',
    toastItemDuplicated: 'Item duplicated',

    // Duplicate
    duplicateItem: 'Duplicate',

    // Date filters
    dateFilterLabel: 'Date',
    dateFilterAll:   'All time',
    dateFilterWeek:  'This week',
    dateFilterMonth: 'This month',
    dateFilterYear:  'This year',

    // Folder counts (no string needed — shown as numbers)

    // Duplicate URL
    duplicateUrlWarning: 'This URL already exists in your vault.',

    // Image download
    downloadImage:   'Download image',
    toastImageSaved: 'Image saved',
    toastImagesSaved: (n: number) => `${n} image${n === 1 ? '' : 's'} saved`,
  },

  es: {
    // App
    appName: 'Hoard',

    // Sidebar
    vaults: 'Bóvedas',
    folders: 'Carpetas',
    allItems: 'Todos los elementos',
    noFolders: 'Sin carpetas aún',
    tags: 'Etiquetas',
    noTags: 'Sin etiquetas aún',
    settings: 'Configuración',

    // Topbar
    searchPlaceholder: 'Buscar…',
    add: 'Agregar',
    resultsFor: 'resultados para',

    // Empty states
    emptyHoard: 'Todo tesoro empieza con una pieza.',
    addFirstItem: 'Agrega tu primer elemento',
    noResults: 'Ningún elemento coincide con tu búsqueda.',

    // Item types
    link: 'Enlace',
    note: 'Nota',
    image: 'Imagen',
    code: 'Código',

    // Add modal
    addToHoard: 'Agregar al Hoard',
    urlPlaceholder: 'https://…',
    fetch: 'Obtener',
    titleOptional: 'Título (opcional)',
    writeNote: 'Escribe tu nota… (soporta Markdown)',
    descriptionOptional: 'Descripción (opcional)',
    clickToPickImage: 'Haz clic para elegir una imagen',
    clickToChange: 'Clic para cambiar',
    shortcutSave: '⌘ + Enter para guardar',
    cancel: 'Cancelar',
    save: 'Guardar',
    codePlaceholder: 'Pega tu código aquí…',
    codeLanguage: 'Lenguaje',

    // Vault modal
    newVaultTitle: 'Nueva bóveda',
    editVaultTitle: 'Editar bóveda',
    vaultNamePlaceholder: 'Nombre de la bóveda',
    color: 'Color',
    create: 'Crear',

    // Folder modal
    newFolderTitle: 'Nueva carpeta',
    folderNamePlaceholder: 'Nombre de la carpeta',
    parentFolderLabel: 'Carpeta padre (opcional)',
    noParent: 'Raíz (sin padre)',

    // Tags
    tagsLabel: 'Etiquetas',
    addTagPlaceholder: 'Agregar etiqueta…',
    createTag: 'Crear',
    tagNamePlaceholder: 'Nombre de etiqueta',
    pickColor: 'Elige un color',

    // Settings
    settingsTitle: 'Configuración',
    settingsGeneral: 'General',
    settingsAppearance: 'Apariencia',
    settingsData: 'Datos',
    settingsLanguage: 'Idioma',
    settingsShowReadingTime: 'Mostrar tiempo de lectura',
    settingsDefaultType: 'Tipo de elemento predeterminado',
    settingsCompactView: 'Vista compacta',
    settingsDataLocation: 'Ubicación de datos',
    settingsOpenFolder: 'Abrir carpeta de datos',
    settingsLanguageEn: 'English',
    settingsLanguageEs: 'Español',
    settingsLaunchAtStartup: 'Iniciar Hoard al arrancar el sistema',

    // Confirmations
    deleteVaultConfirm: (name: string) =>
      `¿Eliminar la bóveda "${name}"? Todo su contenido se perderá.`,
    deleteFolderConfirm: (name: string) =>
      `¿Eliminar la carpeta "${name}" y todos sus elementos?`,
    deleteItemConfirm: '¿Eliminar este elemento?',
    deleteTagConfirm: '¿Eliminar esta etiqueta de todos los elementos?',

    // Card actions
    pinItem: 'Fijar',
    unpinItem: 'Desfijar',
    deleteItem: 'Eliminar',
    openLink: 'Abrir enlace',
    loading: 'Cargando…',

    // Preview panel
    openInBrowser: 'Abrir en el navegador',
    readingTimeMin: (n: number) => `${n} min de lectura`,
    closePreview: 'Cerrar vista previa',
    noDescription: 'Sin descripción.',
    copyCode: 'Copiar',
    codeCopied: '¡Copiado!',

    // Archive status
    archivePending: 'Archivando…',
    archiveDone: 'Página archivada',
    archiveFailed: 'Error al archivar',

    // Multi-select
    selectAll: 'Seleccionar todo',
    deselectAll: 'Deseleccionar todo',
    selected: (n: number) => `${n} seleccionados`,
    moveOrCopy: 'Mover / Copiar',
    deleteSelected: (n: number) => `¿Eliminar ${n} elementos?`,

    // Folder update
    updateFolder: 'Actualizar carpeta',

    // Confirm dialog
    confirmDelete: 'Eliminar',

    // Toast messages
    toastItemAdded:    'Elemento agregado',
    toastItemDeleted:  'Elemento eliminado',
    toastItemPinned:   'Elemento fijado',
    toastItemUnpinned: 'Elemento desfijado',
    toastVaultCreated: 'Bóveda creada',
    toastFolderCreated:'Carpeta creada',
    toastUrlCopied:    'URL copiada',
    toastTagDeleted:   'Etiqueta eliminada',
    toastVaultDeleted: 'Bóveda eliminada',
    toastFolderDeleted:'Carpeta eliminada',
    toastItemMoved:    'Elemento movido',
    toastItemCopied:   'Elemento copiado',

    // Sort
    sortLabel:    'Ordenar',
    sortNewest:   'Más recientes',
    sortOldest:   'Más antiguos',
    sortTitleAz:  'Título A → Z',
    sortTitleZa:  'Título Z → A',

    // Context menu
    copyUrl: 'Copiar URL',

    // Command palette
    cmdPlaceholder:  'Buscar elementos, bóvedas, carpetas…',
    cmdNoResults:    'Sin resultados',
    cmdActionsLabel: 'Acciones',
    cmdItemsLabel:   'Elementos',
    cmdOpenSettings: 'Abrir configuración',
    cmdNewItem:      'Nuevo elemento',
    cmdLockApp:      'Bloquear app',

    // Inline rename
    renamePlaceholder: 'Renombrar…',

    // Edit item modal
    editItem:          'Editar elemento',
    toastItemUpdated:  'Elemento actualizado',
    toastItemDuplicated: 'Elemento duplicado',

    // Duplicate
    duplicateItem: 'Duplicar',

    // Date filters
    dateFilterLabel: 'Fecha',
    dateFilterAll:   'Todo el tiempo',
    dateFilterWeek:  'Esta semana',
    dateFilterMonth: 'Este mes',
    dateFilterYear:  'Este año',

    // Duplicate URL
    duplicateUrlWarning: 'Esta URL ya existe en tu bóveda.',

    // Image download
    downloadImage:   'Descargar imagen',
    toastImageSaved: 'Imagen guardada',
    toastImagesSaved: (n: number) => `${n} imagen${n === 1 ? '' : 'es'} guardada${n === 1 ? '' : 's'}`,
  }
} as const

export type TranslationKey = keyof typeof translations.en
