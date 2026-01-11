// VideoKall Internationalization (i18n) System

const translations = {
	en: {
		// App title
		'app.title': 'VideoKall - Family Video Calls',
		'app.name': 'VideoKall',
		'app.tagline': 'Simple video calls for family',
		
		// Entry screen
		'entry.adminAccess': 'Admin Access',
		'entry.adminDescription': 'Manage rooms with your special code',
		'entry.adminCodePlaceholder': 'Enter special code',
		'entry.accessButton': 'Access',
		
		// Admin screen
		'admin.title': 'VideoKall Admin',
		'admin.logout': 'Logout',
		'admin.createRoom': 'Create New Room',
		'admin.roomNamePlaceholder': 'Room name (e.g., Sunday Family Call)',
		'admin.createButton': 'Create Room',
		'admin.yourRooms': 'Your Rooms',
		'admin.loadingRooms': 'Loading rooms...',
		'admin.noRooms': 'No rooms yet. Create one above!',
		'admin.failedLoadRooms': 'Failed to load rooms',
		'admin.inCall': 'in call',
		'admin.joinButton': 'Join',
		'admin.copyLink': 'Copy link',
		'admin.deleteRoom': 'Delete room',
		'admin.deleteConfirm': 'Are you sure you want to delete this room? Anyone in the call will be disconnected.',
		'admin.failedCreateRoom': 'Failed to create room',
		'admin.failedDeleteRoom': 'Failed to delete room',
		'admin.defaultRoomName': 'New Room',
		
		// Joining screen
		'joining.title': 'Joining Call...',
		'joining.connecting': 'Connecting to room',
		'joining.cancel': 'Cancel',
		
		// Call screen
		'call.connecting': 'Connecting...',
		'call.connected': 'Connected',
		'call.waitingForOthers': 'Waiting for others to join...',
		'call.toggleMic': 'Toggle microphone',
		'call.toggleCamera': 'Toggle camera',
		'call.switchCamera': 'Switch camera',
		'call.pip': 'Picture in Picture (keeps video when switching apps)',
		'call.leaveCall': 'Leave call',
		'call.youAreHost': 'You are now the host',
		
		// Ended screen
		'ended.leftCall': 'Left Call',
		'ended.youLeft': 'You have left the call.',
		'ended.roomDeleted': 'Room Deleted',
		'ended.roomDeletedByAdmin': 'The room has been deleted by the admin.',
		'ended.rejoin': 'Rejoin Call',
		'ended.backHome': 'Back to Home',
		
		// Errors
		'error.enterCode': 'Please enter the special code',
		'error.invalidCode': 'Invalid special code',
		'error.connectionFailed': 'Failed to connect. Please try again.',
		'error.roomNotFound': 'Room not found. It may have been deleted.',
		'error.joinFailed': 'Failed to join room. Please try again.',
		'error.mediaFailed': 'Failed to start call. Please check camera/microphone permissions.',
		'error.mediaRestoreFailed': 'Could not restore camera/microphone. Please rejoin the call.',
		
		// Language
		'lang.language': 'Language',
		'lang.en': 'English',
		'lang.ru': 'Русский'
	},
	
	ru: {
		// App title
		'app.title': 'VideoKall - Семейные видеозвонки',
		'app.name': 'VideoKall',
		'app.tagline': 'Простые видеозвонки для семьи',
		
		// Entry screen
		'entry.adminAccess': 'Администратор',
		'entry.adminDescription': 'Управляйте комнатами с помощью секретного кода',
		'entry.adminCodePlaceholder': 'Введите секретный код',
		'entry.accessButton': 'Войти',
		
		// Admin screen
		'admin.title': 'Панель администратора',
		'admin.logout': 'Выйти',
		'admin.createRoom': 'Создать комнату',
		'admin.roomNamePlaceholder': 'Название комнаты (например, Комната человека-паука)',
		'admin.createButton': 'Создать',
		'admin.yourRooms': 'Ваши комнаты',
		'admin.loadingRooms': 'Загрузка комнат...',
		'admin.noRooms': 'Пока нет комнат. Создайте первую!',
		'admin.failedLoadRooms': 'Не удалось загрузить комнаты',
		'admin.inCall': 'в звонке',
		'admin.joinButton': 'Войти',
		'admin.copyLink': 'Копировать ссылку',
		'admin.deleteRoom': 'Удалить комнату',
		'admin.deleteConfirm': 'Вы уверены, что хотите удалить эту комнату? Все участники будут отключены.',
		'admin.failedCreateRoom': 'Не удалось создать комнату',
		'admin.failedDeleteRoom': 'Не удалось удалить комнату',
		'admin.defaultRoomName': 'Новая комната',
		
		// Joining screen
		'joining.title': 'Подключение...',
		'joining.connecting': 'Подключение к комнате',
		'joining.cancel': 'Отмена',
		
		// Call screen
		'call.connecting': 'Подключение...',
		'call.connected': 'Подключено',
		'call.waitingForOthers': 'Ожидание других участников...',
		'call.toggleMic': 'Включить/выключить микрофон',
		'call.toggleCamera': 'Включить/выключить камеру',
		'call.switchCamera': 'Переключить камеру',
		'call.pip': 'Картинка в картинке (сохраняет видео при переключении приложений)',
		'call.leaveCall': 'Покинуть звонок',
		'call.youAreHost': 'Теперь вы организатор',
		
		// Ended screen
		'ended.leftCall': 'Звонок завершён',
		'ended.youLeft': 'Вы покинули звонок.',
		'ended.roomDeleted': 'Комната удалена',
		'ended.roomDeletedByAdmin': 'Комната была удалена администратором.',
		'ended.rejoin': 'Вернуться в звонок',
		'ended.backHome': 'На главную',
		
		// Errors
		'error.enterCode': 'Пожалуйста, введите секретный код',
		'error.invalidCode': 'Неверный секретный код',
		'error.connectionFailed': 'Не удалось подключиться. Попробуйте снова.',
		'error.roomNotFound': 'Комната не найдена. Возможно, она была удалена.',
		'error.joinFailed': 'Не удалось войти в комнату. Попробуйте снова.',
		'error.mediaFailed': 'Не удалось начать звонок. Проверьте разрешения камеры и микрофона.',
		'error.mediaRestoreFailed': 'Не удалось восстановить камеру/микрофон. Пожалуйста, перезайдите в звонок.',
		
		// Language
		'lang.language': 'Язык',
		'lang.en': 'English',
		'lang.ru': 'Русский'
	}
};

class I18n {
	constructor() {
		this.currentLocale = this.detectLocale();
		this.listeners = [];
	}
	
	// Detect browser locale and return supported language
	detectLocale() {
		// Check localStorage first
		const savedLocale = localStorage.getItem('videokall-locale');
		if (savedLocale && translations[savedLocale]) {
			return savedLocale;
		}
		
		// Check browser language
		const browserLang = navigator.language || navigator.userLanguage;
		const shortLang = browserLang.split('-')[0].toLowerCase();
		
		// Return supported locale or default to English
		if (translations[shortLang]) {
			return shortLang;
		}
		
		return 'en';
	}
	
	// Get translation by key
	t(key, params = {}) {
		const translation = translations[this.currentLocale]?.[key] 
			|| translations['en']?.[key] 
			|| key;
		
		// Replace parameters like {name} with actual values
		return translation.replace(/\{(\w+)\}/g, (match, param) => {
			return params[param] !== undefined ? params[param] : match;
		});
	}
	
	// Set locale and update UI
	setLocale(locale) {
		if (!translations[locale]) {
			console.warn(`Locale "${locale}" not supported`);
			return;
		}
		
		this.currentLocale = locale;
		localStorage.setItem('videokall-locale', locale);
		
		// Update page title
		document.title = this.t('app.title');
		
		// Update all elements with data-i18n attribute
		this.updateDOM();
		
		// Update CSS content (for pseudo-elements)
		this.updateCSSVariables();
		
		// Notify listeners
		this.listeners.forEach(callback => callback(locale));
	}
	
	// Get current locale
	getLocale() {
		return this.currentLocale;
	}
	
	// Get available locales
	getAvailableLocales() {
		return Object.keys(translations);
	}
	
	// Update all DOM elements with data-i18n attributes
	updateDOM() {
		// Update text content
		document.querySelectorAll('[data-i18n]').forEach(el => {
			const key = el.getAttribute('data-i18n');
			el.textContent = this.t(key);
		});
		
		// Update placeholders
		document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
			const key = el.getAttribute('data-i18n-placeholder');
			el.placeholder = this.t(key);
		});
		
		// Update titles
		document.querySelectorAll('[data-i18n-title]').forEach(el => {
			const key = el.getAttribute('data-i18n-title');
			el.title = this.t(key);
		});
	}
	
	// Update CSS custom properties for pseudo-element content
	updateCSSVariables() {
		document.documentElement.style.setProperty(
			'--i18n-waiting-text',
			`"${this.t('call.waitingForOthers')}"`
		);
	}
	
	// Add change listener
	onChange(callback) {
		this.listeners.push(callback);
	}
	
	// Remove change listener
	offChange(callback) {
		this.listeners = this.listeners.filter(cb => cb !== callback);
	}
	
	// Initialize i18n - call on page load
	init() {
		// Set initial page title
		document.title = this.t('app.title');
		
		// Update DOM with translations
		this.updateDOM();
		
		// Update CSS variables
		this.updateCSSVariables();
	}
}

// Create global i18n instance
window.i18n = new I18n();
