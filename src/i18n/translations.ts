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
  }
} as const

export type TranslationKey = keyof typeof translations.en
