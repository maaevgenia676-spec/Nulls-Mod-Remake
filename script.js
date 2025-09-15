let schema = {};
let GROUP_KEYS = [];
let PARAMS_BY_GROUP = {};
let OBJECT_EXAMPLES_BY_GROUP = {};
let model = {
    "@title": {},
    "@description": {},
    "@author": "",
    "@version": "",
};
let files = [];
let modIconFile = null;
let currentLanguage = "en";
const KNOWN_LANGUAGES = ["ru", "en", "cn", "es", "pt", "tr", "fr"];

const KNOWN_FOLDERS = ["movie", "font", "json", "music", "sc", "sc3d", "sfx", "shader"];

const metaTitle = document.getElementById("meta-title");
const metaDesc = document.getElementById("meta-description");
const metaAuthor = document.getElementById("meta-author");
const metaVersion = document.getElementById("meta-version");
const languageSelect = document.getElementById("language-select");

const iconInput = document.getElementById("mod-icon");
const iconPreview = document.getElementById("icon-preview");
const removeIconButton = document.getElementById("remove-icon-btn");

const folderSelect = document.getElementById("folder-select");
const fileInput = document.getElementById("file-input");
const filesList = document.getElementById("files-list");

const addObjectGroupInput = document.getElementById("add-object-group");
const addObjectGroupOptions = document.getElementById("add-object-group-options");
const addObjBtn = document.getElementById("add-object-btn");
const groupsRoot = document.getElementById("groups-root");

const jsonPreview = document.getElementById("json-preview");
const metaPreview = document.getElementById("meta-preview");
const previewTitle = document.getElementById("preview-title");
const previewDescription = document.getElementById("preview-description");
const previewAuthor = document.getElementById("preview-author");

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importZipInput = document.getElementById("import-zip");

const applyBtn = document.getElementById("apply-json");
const formatBtn = document.getElementById("format-json");
const codeError = document.getElementById("code-error");

const mainTabs = new bootstrap.Tab(document.getElementById('visual-tab'));
const codeTab = document.getElementById('code-tab');

const resetDataBtn = document.getElementById("reset-data-btn");

const DB_NAME = 'mod-generator-db';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function createModal(title, message, isConfirm, onConfirm) {
    const modalId = `custom-modal-${Math.random().toString(36).substr(2, 9)}`;
    const modalHtml = `
        <div class="modal fade" id="${modalId}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content soft">
                    <div class="modal-header border-0">
                        <h5 class="modal-title text-white">${title}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-muted-2">
                        ${message}
                    </div>
                    <div class="modal-footer border-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                        ${isConfirm ? `<button type="button" class="btn btn-primary" id="confirm-btn">Подтвердить</button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalElement = document.getElementById(modalId);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    modalElement.addEventListener('hidden.bs.modal', () => {
        modalElement.remove();
    });

    if (isConfirm) {
        const confirmBtn = modalElement.querySelector('#confirm-btn');
        confirmBtn.addEventListener('click', () => {
            onConfirm();
            modal.hide();
        });
    }
}

function showAlert(message, title = "Уведомление") {
    createModal(title, message, false);
}

function showConfirm(message, title = "Подтверждение", onConfirm) {
    createModal(title, message, true, onConfirm);
}


let cm = CodeMirror(document.getElementById("editor"), {
    value: "{\n  \n}",
    mode: {
        name: "javascript",
        json: true
    },
    theme: "material-darker",
    lineNumbers: true,
    tabSize: 2,
    indentUnit: 2,
    lineWrapping: true,
});

const debounce = (fn, ms = 400) => {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
};

function getValueForLang(obj, lang) {
    if (typeof obj === "string") {
        return obj;
    }
    const upperLang = lang.toUpperCase();
    const lowerLang = lang.toLowerCase();
    return obj?.[upperLang] || obj?.[lowerLang] || "";
}

function setValueForLang(obj, lang, value) {
    if (typeof obj === "object" && obj !== null) {
        const upperLang = lang.toUpperCase();
        if (value) {
            obj[upperLang] = value;
        } else {
            delete obj[upperLang];
        }
    }
}

function getObjectKeyByValue(obj, value) {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (obj[key] === value) {
                return key;
            }
        }
    }
    return null;
}

// =========================================================================
// IndexedDB and localStorage Functions
// =========================================================================

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveFileToDb(fileObject, type, folder) {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const fileData = {
            name: fileObject.name,
            file: fileObject,
            type: type, // 'modIcon' or 'modFile'
            folder: folder || null,
        };
        store.put(fileData);
        await tx.complete;
    } catch (e) {
        console.error("Failed to save file to IndexedDB:", e);
    }
}

async function getFilesFromDb() {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const allFiles = await store.getAll();
        await tx.complete;
        return allFiles;
    } catch (e) {
        console.error("Failed to get files from IndexedDB:", e);
        return [];
    }
}

async function clearIndexedDb() {
    try {
        const db = await openDatabase();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        await tx.complete;
    } catch (e) {
        console.error("Failed to clear IndexedDB:", e);
    }
}

function saveModelToLocalStorage() {
    const data = {
        model,
        currentLanguage,
    };
    localStorage.setItem('modGeneratorData', JSON.stringify(data));
    console.log("Auto-saved model to localStorage.");
}

async function loadModelFromLocalStorage() {
    // Load model data from localStorage
    const storedData = localStorage.getItem('modGeneratorData');
    if (storedData) {
        try {
            const data = JSON.parse(storedData);
            model = data.model;
            currentLanguage = data.currentLanguage;
            showAlert("Данные успешно восстановлены из последней сессии.");
        } catch (e) {
            console.error("Failed to load data from localStorage:", e);
            showAlert("Не удалось загрузить данные из последней сессии.");
        }
    }

    // Load files from IndexedDB
    const storedFiles = await getFilesFromDb();
    if (storedFiles.length > 0) {
        modIconFile = storedFiles.find(f => f.type === 'modIcon')?.file || null;
        files = storedFiles.filter(f => f.type === 'modFile').map(f => ({ file: f.file, folder: f.folder }));

        if (modIconFile) {
            iconPreview.src = URL.createObjectURL(modIconFile);
            iconPreview.classList.remove("d-none");
            removeIconButton.classList.remove("d-none");
        }
        renderFiles();
    }
}

const autoSave = debounce(() => {
    saveModelToLocalStorage();
}, 5000); // Auto-save model every 5 seconds

function resetDataAndReload() {
    showConfirm("Вы уверены, что хотите сбросить все данные? Это действие необратимо.", "Сброс данных", async () => {
        localStorage.clear();
        await clearIndexedDb();
        window.location.reload();
    });
}
// =========================================================================
// End of IndexedDB and localStorage functions
// =========================================================================

const updateCodeMirror = debounce(() => {
    const text = cm.getValue();
    try {
        JSON.parse(text);
        codeError.classList.add("d-none");
    } catch (e) {
        codeError.textContent = "Ошибка JSON: " + e.message;
        codeError.classList.remove("d-none");
    }
}, 500);

cm.on("change", updateCodeMirror);

codeTab.addEventListener('shown.bs.tab', () => {
    cm.refresh();
});

function loadMeta(meta) {
    metaTitle.value = getValueForLang(meta["@title"], currentLanguage);
    metaDesc.value = getValueForLang(meta["@description"], currentLanguage);
    metaAuthor.value = meta["@author"] || "";
    metaVersion.value = meta["@version"] || "";
    updateMetaPreview();
}

function generateJson() {
    const json = {};

    if (model["@title"] && Object.keys(model["@title"]).length > 0) {
        json["@title"] = model["@title"];
    }
    if (model["@description"] && Object.keys(model["@description"]).length > 0) {
        json["@description"] = model["@description"];
    }
    if (model["@author"]) {
        json["@author"] = model["@author"];
    }
    if (model["@version"]) {
        json["@version"] = model["@version"];
    }

    for (const group in model) {
        if (group.startsWith("@")) continue;
        if (Object.keys(model[group]).length > 0) {
            json[group] = model[group];
        }
    }
    return json;
}

(async function loadSchema() {
    try {
        const res = await fetch("https://raw.githubusercontent.com/darkmean-dev/nullsmods-schema/main/schema.json");
        const data = await res.json();
        const props = data?.properties || {};
        schema = props;

        GROUP_KEYS = Object.keys(props).filter(k => !k.startsWith("@"));

        GROUP_KEYS.forEach(g => {
            const params = Object.keys(props[g]?.additionalProperties?.properties || {});
            PARAMS_BY_GROUP[g] = params;
            const examples = props[g]?.propertyNames?.examples || [];
            OBJECT_EXAMPLES_BY_GROUP[g] = ["*", ...examples];
        });

        populateFolderSelect();
        createSearchableDropdown(addObjectGroupInput, addObjectGroupOptions, GROUP_KEYS, addObjectGroupInput.value);
        populateLanguageSelect();
        
        await loadModelFromLocalStorage();
        renderAll();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }

    } catch (error) {
        console.error("Failed to load schema:", error);
        showAlert("Не удалось загрузить схему модов. Некоторые функции могут не работать.");
    }
})();

function populateLanguageSelect() {
    languageSelect.innerHTML = "";
    KNOWN_LANGUAGES.forEach(lang => {
        const opt = document.createElement("option");
        opt.value = lang;
        opt.textContent = lang.toUpperCase();
        languageSelect.appendChild(opt);
    });
    languageSelect.value = currentLanguage;
}

languageSelect.addEventListener("change", (e) => {
    currentLanguage = e.target.value;
    repaint();
    autoSave();
});


const debouncedUpdateJson = debounce(() => {
    const outputModel = JSON.parse(JSON.stringify(model));

    if (outputModel["@title"] && typeof outputModel["@title"] === 'object') {
        const titleText = getValueForLang(outputModel["@title"], currentLanguage);
        outputModel["@title"] = titleText || Object.values(outputModel["@title"])[0] || "";
    }

    if (outputModel["@description"] && typeof outputModel["@description"] === 'object') {
        const descText = getValueForLang(outputModel["@description"], currentLanguage);
        outputModel["@description"] = descText || Object.values(outputModel["@description"])[0] || "";
    }

    jsonPreview.textContent = JSON.stringify(outputModel, null, 2);
    cm.setValue(JSON.stringify(model, null, 2));
    autoSave();
}, 500);

metaTitle.addEventListener("input", (e) => {
    if (!model["@title"]) model["@title"] = {};
    setValueForLang(model["@title"], currentLanguage, e.target.value);
    updateMetaPreview();
    debouncedUpdateJson();
});

metaDesc.addEventListener("input", (e) => {
    if (!model["@description"]) model["@description"] = {};
    setValueForLang(model["@description"], currentLanguage, e.target.value);
    updateMetaPreview();
    debouncedUpdateJson();
});

metaAuthor.addEventListener("input", (e) => {
    model["@author"] = e.target.value;
    updateMetaPreview();
    debouncedUpdateJson();
});

metaVersion.addEventListener("input", (e) => {
    model["@version"] = e.target.value;
    updateMetaPreview();
    debouncedUpdateJson();
});


function cleanupMeta() {
    // This function is no longer needed on every input,
    // as cleanup is now handled on export.
}

function updateMetaPreview() {
    const titleText = getValueForLang(model["@title"], currentLanguage);
    const descText = getValueForLang(model["@description"], currentLanguage);
    const authorText = model["@author"];

    if (titleText || descText || authorText) {
        metaPreview.classList.remove("d-none");
        previewTitle.innerHTML = titleText || "Название мода";
        previewDescription.innerHTML = (descText || "Описание мода").replace(/\n/g, '<br>');
        previewAuthor.innerHTML = authorText ? `Автор: ${authorText}` : "Автор: Не указан";
    } else {
        metaPreview.classList.add("d-none");
    }
}

iconInput.addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.src = URL.createObjectURL(f);
    img.onload = () => {
        if (img.width > 640 || img.height > 640) {
            showAlert("Иконка должна быть ≤640×640");
            iconInput.value = "";
            iconPreview.classList.add("d-none");
            iconPreview.removeAttribute("src");
            modIconFile = null;
        } else {
            modIconFile = f;
            iconPreview.src = img.src;
            iconPreview.classList.remove("d-none");
            removeIconButton.classList.remove("d-none");
            saveFileToDb(modIconFile, 'modIcon', null);
        }
    };
});

removeIconButton.addEventListener("click", () => {
    iconInput.value = "";
    iconPreview.classList.add("d-none");
    iconPreview.removeAttribute("src");
    modIconFile = null;
    saveFileToDb(null, 'modIcon', null);
    autoSave();
});

function populateFolderSelect() {
    folderSelect.innerHTML = "";
    KNOWN_FOLDERS.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        folderSelect.appendChild(opt);
    });
}
function createParamDropdown(groupKey, objectCard) {
    const params = PARAMS_BY_GROUP[groupKey];
    if (!params || params.length === 0) return null;

    const dropdownHtml = `
        <div class="dropdown add-param-dropdown">
            <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                Добавить параметр
            </button>
            <ul class="dropdown-menu">
                ${params.map(param => `<li class="dropdown-item" data-param-key="${param}">${param}</li>`).join('')}
            </ul>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = dropdownHtml.trim();
    const dropdown = tempDiv.firstChild;

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const paramKey = e.target.getAttribute('data-param-key');
            addParamToObject(objectCard, groupKey, paramKey);
        });
    });

    return dropdown;
}

fileInput.addEventListener("change", e => {
    const folder = folderSelect.value || KNOWN_FOLDERS[0];
    [...e.target.files].forEach(f => {
        if (!files.some(item => item.folder === folder && item.file.name === f.name)) {
            files.push({
                file: f,
                folder
            });
            saveFileToDb(f, 'modFile', folder);
        }
    });
    e.target.value = "";
    renderFiles();
    autoSave();
});

function renderFiles() {
    filesList.innerHTML = "";
    if (files.length === 0) {
        const li = document.createElement("li");
        li.className = "list-group-item text-muted-2";
        li.textContent = "Пока нет файлов...";
        filesList.appendChild(li);
        return;
    }
    files.forEach((item, idx) => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.textContent = `${item.folder}/${item.file.name}`;
        const del = document.createElement("button");
        del.className = "btn btn-sm btn-danger";
        del.textContent = "Удалить";
        del.addEventListener("click", () => {
            const fileId = files.find(f => f.file.name === item.file.name)?.id;
            if (fileId) {
                // Here's an example of how to delete a single file. For now, we'll simplify.
                // A full implementation would need to track file IDs.
                // Let's just update the entire DB for simplicity in this example.
            }
            files.splice(idx, 1);
            // Re-save all files to DB
            clearIndexedDb().then(() => {
                if (modIconFile) saveFileToDb(modIconFile, 'modIcon', null);
                files.forEach(f => saveFileToDb(f.file, 'modFile', f.folder));
                renderFiles();
                autoSave();
            });
        });
        li.appendChild(del);
        filesList.appendChild(li);
    });
}

function createSearchableDropdown(inputElement, optionsContainer, allOptions, selectedValue, onSelectCallback) {
    optionsContainer.innerHTML = "";

    allOptions.forEach(option => {
        const div = document.createElement("div");
        div.className = "option-item";
        div.textContent = option;
        div.onclick = () => {
            selectOption(inputElement, optionsContainer, option);
            if (onSelectCallback) onSelectCallback(option);
        };
        optionsContainer.appendChild(div);
    });

    inputElement.value = selectedValue || "";

    inputElement.addEventListener("input", () => {
        filterOptions(inputElement, optionsContainer);
    });

    inputElement.addEventListener("focus", () => {
        toggleDropdown(optionsContainer, true);
        filterOptions(inputElement, optionsContainer);
    });
}

function filterOptions(searchInput, optionsContainer) {
    const searchInputText = searchInput.value.toLowerCase();
    const options = Array.from(optionsContainer.children);

    options.forEach(option => {
        if (option.textContent.toLowerCase().includes(searchInputText)) {
            option.style.display = "block";
        } else {
            option.style.display = "none";
        }
    });

    toggleDropdown(optionsContainer, true);
}

function selectOption(inputElement, optionsContainer, value) {
    inputElement.value = value;
    toggleDropdown(optionsContainer, false);
}

function toggleDropdown(container, show) {
    container.style.display = show ? "block" : "none";
}

document.addEventListener("click", (event) => {
    document.querySelectorAll('.options-container').forEach(container => {
        const inputElement = container.previousElementSibling;
        if (inputElement && !inputElement.contains(event.target) && !container.contains(event.target)) {
            toggleDropdown(container, false);
        }
    });

    // Hide any open param-choices lists when clicking outside
    document.querySelectorAll('.param-choices').forEach(pc => {
        if (!pc.contains(event.target) && !pc._ownerButton?.contains(event.target)) {
            pc.style.display = 'none';
        }
    });
});
// End of Custom Select / Searchable Dropdown Logic


addObjBtn.addEventListener("click", () => {
    const group = addObjectGroupInput.value;
    addObject(group);
    addObjectGroupInput.value = "";
    toggleDropdown(addObjectGroupOptions, false);
    autoSave();
});

function addObject(group, objName = "*") {
    if (!group) return;
    if (!model[group]) model[group] = {};
    
    if (!GROUP_KEYS.includes(group)) {
        showAlert(`Группа "${group}" не найдена в схеме.`);
        return;
    }

    if (model[group][objName] === undefined) {
        model[group][objName] = {};
    }

    if (Object.keys(model[group][objName]).length === 0) {
        const firstParam = PARAMS_BY_GROUP[group]?.[0];
        if (firstParam) {
            const paramSchema = schema[group]?.additionalProperties?.properties?.[firstParam];
            let defaultValue = "";
            if (paramSchema?.type === 'boolean') {
                defaultValue = false;
            } else if (paramSchema?.default !== undefined) {
                defaultValue = paramSchema.default;
            } else if (paramSchema?.type === "array") {
                defaultValue = [""];
            }
            model[group][objName][firstParam] = defaultValue;
        }
    }
    repaint();
}

function renderGroups() {
    groupsRoot.innerHTML = "";
    const hasContent = GROUP_KEYS.some(g => model[g] && Object.keys(model[g]).length > 0);

    if (!hasContent) {
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center p-5 text-muted-2';
        emptyState.innerHTML = `
            <h5 class="fw-normal">Объектов пока нет</h5>
            <p class="mb-0">Используйте поле поиска и кнопку "Добавить", чтобы начать.</p>
        `;
        groupsRoot.appendChild(emptyState);
        return;
    }

    GROUP_KEYS.forEach(group => {
        const groupObj = model[group] || {};
        if (Object.keys(groupObj).length === 0) return;

        const gCard = document.createElement("div");
        gCard.className = "group-card";

        const header = document.createElement("div");
        header.className = "group-header";

        const title = document.createElement("div");
        title.className = "group-title";
        title.textContent = group;

        const addForGroup = document.createElement("button");
        addForGroup.className = "btn btn-sm btn-outline-light";
        addForGroup.textContent = "Добавить объект";
        addForGroup.addEventListener("click", () => {
            addObject(group);
            autoSave();
        });

        header.appendChild(title);
        header.appendChild(addForGroup);

        const grid = document.createElement("div");
        grid.className = "objects-grid";

        Object.keys(groupObj).forEach(objectName => {
            const params = groupObj[objectName] || {};
            const oCard = document.createElement("div");
            oCard.className = "object-card";

            const objSelectContainer = document.createElement("div");
            objSelectContainer.className = "object-head custom-select-container";

            const objSelectInput = document.createElement("input");
            objSelectInput.type = "text";
            objSelectInput.className = "form-control form-control-dark custom-select-input object-select";
            objSelectInput.placeholder = "Поиск объекта...";
            objSelectInput.value = objectName;

            const objSelectOptions = document.createElement("div");
            objSelectOptions.className = "options-container";

            createSearchableDropdown(
                objSelectInput,
                objSelectOptions,
                [...new Set([...OBJECT_EXAMPLES_BY_GROUP[group], objectName])],
                objectName,
                (newName) => {
                    if (newName === objectName) return;
                    model[group][newName] = model[group][objectName] || {};
                    delete model[group][objectName];
                    repaint();
                    autoSave();
                }
            );

            objSelectContainer.appendChild(objSelectInput);
            objSelectContainer.appendChild(objSelectOptions);

            const actionsContainer = document.createElement("div");
            actionsContainer.className = "object-actions";

            const addParam = document.createElement("button");
            addParam.className = "btn btn-sm btn-outline-light";
            addParam.textContent = "Параметр";

            // popup-style scrollable list (like options-container)
            const paramChoices = document.createElement('div');
            paramChoices.className = 'param-choices';
            Object.assign(paramChoices.style, {
                display: 'none',
                position: 'absolute',
                zIndex: 60,
                right: '0px',
                top: 'calc(100% + 8px)',
                minWidth: '220px',
                maxHeight: '220px',
                overflowY: 'auto',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
            });

            // Mark owner so global click handler can detect outside clicks
            paramChoices._ownerButton = addParam;

            // Ensure actions container is positioning context for absolute popup
            actionsContainer.style.position = 'relative';

            const delObj = document.createElement("button");
            delObj.className = "btn btn-sm btn-danger";
            delObj.textContent = "Удалить";
            delObj.addEventListener("click", () => {
                showConfirm(`Вы уверены, что хотите удалить объект "${objectName}"?`, "Подтверждение", () => {
                    delete model[group][objectName];
                    if (Object.keys(model[group]).length === 0) delete model[group];
                    repaint();
                    autoSave();
                });
            });

            actionsContainer.appendChild(addParam);
            actionsContainer.appendChild(delObj);
            actionsContainer.appendChild(paramChoices);

            // When clicking the addParam button - toggle the param choices popup
            addParam.addEventListener('click', (e) => {
                e.stopPropagation();

                // compute available params at the time of opening
                const availableParamsToAdd = PARAMS_BY_GROUP[group].filter(p => !Object.keys(model[group][objectName] || {}).includes(p));

                // clear previous content
                paramChoices.innerHTML = '';

                if (availableParamsToAdd.length === 0) {
                    const li = document.createElement('div');
                    li.className = 'option-item text-muted-2';
                    li.textContent = 'Нет доступных параметров';
                    paramChoices.appendChild(li);
                    paramChoices.style.display = 'block';
                    return;
                }

                availableParamsToAdd.forEach(paramName => {
                    const div = document.createElement('div');
                    div.className = 'option-item';
                    div.textContent = paramName;
                    div.style.padding = '8px 10px';
                    div.style.cursor = 'pointer';
                    div.style.borderRadius = '6px';
                    div.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const paramSchema = schema[group]?.additionalProperties?.properties?.[paramName];
                        let defaultValue = "";
                        if (paramSchema?.type === 'boolean') {
                            defaultValue = false;
                        } else if (paramSchema?.default !== undefined) {
                            defaultValue = paramSchema.default;
                        } else if (paramSchema?.type === "array") {
                            defaultValue = [""];
                        }
                        if (!model[group]) model[group] = {};
                        if (!model[group][objectName]) model[group][objectName] = {};
                        model[group][objectName][paramName] = defaultValue;
                        paramChoices.style.display = 'none';
                        repaint();
                        autoSave();
                    });
                    paramChoices.appendChild(div);
                });

                // toggle visibility
                paramChoices.style.display = paramChoices.style.display === 'block' ? 'none' : 'block';
            });

            const pList = document.createElement("div");
            pList.className = "param-list";

            Object.keys(params).forEach(paramName => {
                const paramSchema = schema[group]?.additionalProperties?.properties?.[paramName];
                const isBoolean = paramSchema?.type === 'boolean';
                const isObject = paramSchema?.type === 'object';
                const isNumber = paramSchema?.type === 'number';

                const pill = document.createElement("div");
                pill.className = "param-pill";

                const paramHeader = document.createElement("div");
                paramHeader.className = "param-header d-flex justify-content-between align-items-center mb-1";

                const nameLabel = document.createElement("span");
                nameLabel.textContent = paramName;
                nameLabel.className = "param-name-label";

                const delParamBtn = document.createElement("button");
                delParamBtn.className = "remove-value-btn-param btn btn-sm btn-danger";
                delParamBtn.textContent = "×";
                delParamBtn.addEventListener("click", () => {
                    delete model[group][objectName][paramName];
                    repaint();
                    autoSave();
                });

                paramHeader.appendChild(nameLabel);
                paramHeader.appendChild(delParamBtn);
                pill.appendChild(paramHeader);

                const addValueBtn = document.createElement("button");
                addValueBtn.className = "add-value-btn btn btn-sm btn-outline-light mb-1";
                addValueBtn.innerHTML = "+ Добавить значение...";
                addValueBtn.addEventListener("click", () => {
                    const currentValue = model[group][objectName][paramName];
                    if (Array.isArray(currentValue)) currentValue.push("");
                    else model[group][objectName][paramName] = [currentValue, ""];
                    repaint();
                    autoSave();
                });
                pill.appendChild(addValueBtn);

                const valueContainer = document.createElement("div");
                valueContainer.className = `param-value d-flex flex-wrap gap-2`;

                if (Array.isArray(params[paramName])) {
                    params[paramName].forEach((value, valueIndex) => {
                        const input = document.createElement("input");
                        input.type = isNumber ? "number" : "text";
                        input.value = value;
                        input.className = "form-control form-control-sm";
                        input.style.minWidth = "80px";

                        input.addEventListener("input", (e) => {
                            let newValue = e.target.value;
                            if (isNumber) newValue = parseFloat(newValue);
                            model[group][objectName][paramName][valueIndex] = newValue;
                            debouncedUpdateJson();
                        });

                        valueContainer.appendChild(input);
                    });
                } else if (isBoolean) {
                    const input = document.createElement("input");
                    input.type = "checkbox";
                    input.checked = params[paramName];
                    input.addEventListener("change", (e) => {
                        model[group][objectName][paramName] = e.target.checked;
                        debouncedUpdateJson();
                    });
                    valueContainer.appendChild(input);
                } else if (isObject) {
                    const obj = params[paramName] || {};
                    const objKey = Object.keys(obj)[0];
                    const objValue = obj[objKey];

                    const keyInput = document.createElement("input");
                    keyInput.type = "text";
                    keyInput.placeholder = "key";
                    keyInput.value = objKey || "";
                    keyInput.addEventListener("input", debounce((e) => {
                        const newKey = e.target.value;
                        const oldValue = model[group][objectName][paramName]?.[objKey];
                        if (newKey) model[group][objectName][paramName] = { [newKey]: oldValue || "" };
                        else delete model[group][objectName][paramName];
                        repaint();
                        autoSave();
                    }, 500));

                    const valueInput = document.createElement("input");
                    valueInput.type = "text";
                    valueInput.placeholder = "value";
                    valueInput.value = objValue || "";
                    valueInput.addEventListener("input", (e) => {
                        if (objKey) model[group][objectName][paramName][objKey] = e.target.value;
                        debouncedUpdateJson();
                    });

                    valueContainer.appendChild(keyInput);
                    valueContainer.appendChild(valueInput);
                } else {
                    const input = document.createElement("input");
                    input.type = isNumber ? "number" : "text";
                    input.value = params[paramName];
                    input.addEventListener("input", (e) => {
                        let value = e.target.value;
                        if (isNumber) value = parseFloat(value);
                        model[group][objectName][paramName] = value;
                        debouncedUpdateJson();
                    });
                    valueContainer.appendChild(input);
                }

                pill.appendChild(valueContainer);
                pList.appendChild(pill);
            });

            oCard.appendChild(objSelectContainer);
            oCard.appendChild(actionsContainer);
            oCard.appendChild(pList);
            grid.appendChild(oCard);
        });

        gCard.appendChild(header);
        gCard.appendChild(grid);
        groupsRoot.appendChild(gCard);
    });
}



function repaint() {
    loadMeta(model);
    renderGroups();
    renderFiles();
    debouncedUpdateJson();
}

function renderAll() {
    repaint();
    renderFiles();
}

exportBtn.addEventListener("click", async () => {
    const zip = new JSZip();

    // Add JSON
    const modJson = generateJson();
    zip.file("content.json", JSON.stringify(modJson, null, 2));

    // Add Icon
    if (modIconFile) {
        zip.file("icon.png", modIconFile);
    }

    // Add files preserving their folder names in root
    if (files.length > 0) {
        files.forEach(item => {
            const folder = zip.folder(item.folder);
            folder.file(item.file.name, item.file);
        });
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "mod.zip";
    link.click();
});



importBtn.addEventListener("click", () => importZipInput.click());
resetDataBtn.addEventListener("click", resetDataAndReload);

importZipInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        const newModel = {};
        const newFiles = [];
        let newModIconFile = null;

        const jsonFile = zip.file("content.json");
        if (jsonFile) {
            const content = await jsonFile.async("string");
            const parsedJson = JSON.parse(content);
            Object.assign(newModel, parsedJson);
            
            // Fix for multilinguality issue
            if (typeof newModel["@title"] === "string") {
                newModel["@title"] = { [currentLanguage.toUpperCase()]: newModel["@title"] };
            }
            if (typeof newModel["@description"] === "string") {
                newModel["@description"] = { [currentLanguage.toUpperCase()]: newModel["@description"] };
            }
        }

        const iconFile = zip.file("icon.png");
        if (iconFile) {
            const blob = await iconFile.async("blob");
            newModIconFile = new File([blob], "icon.png", { type: "image/png" });
            const img = new Image();
            img.src = URL.createObjectURL(newModIconFile);
            img.onload = () => {
                iconPreview.src = img.src;
                iconPreview.classList.remove("d-none");
                removeIconButton.classList.remove("d-none");
            };
        }

        // --- Corrected logic for iterating through zip files ---
        zip.forEach(async (relativePath, zipEntry) => {
            if (!zipEntry.dir && relativePath !== "content.json" && relativePath !== "icon.png") {
                const parts = relativePath.split('/');
                const folder = parts[0];
                const fileName = parts[1];
                if (KNOWN_FOLDERS.includes(folder)) {
                    const blob = await zipEntry.async("blob");
                    const fileObj = new File([blob], fileName);
                    newFiles.push({
                        file: fileObj,
                        folder: folder
                    });
                }
            }
        });

        // Small delay to ensure all files are processed before re-rendering
        setTimeout(async () => {
            model = newModel;
            files = newFiles;
            modIconFile = newModIconFile;
            loadMeta(model);
            
            await clearIndexedDb();
            if (modIconFile) await saveFileToDb(modIconFile, 'modIcon', null);
            for (const f of files) {
                await saveFileToDb(f.file, 'modFile', f.folder);
            }

            repaint();
            autoSave();

            showAlert("Мод успешно импортирован!");
        }, 500);

    } catch (error) {
        console.error("Error importing ZIP:", error);
        showAlert("Не удалось импортировать ZIP-файл. Пожалуйста, проверьте формат файла.");
    } finally {
        importZipInput.value = "";
    }
});

formatBtn.addEventListener("click", () => {
    try {
        const formatted = JSON.stringify(JSON.parse(cm.getValue()), null, 2);
        cm.setValue(formatted);
        codeError.classList.add("d-none");
    } catch (e) {
        codeError.textContent = "Невозможно отформатировать, неверный JSON.";
        codeError.classList.remove("d-none");
    }
});

applyBtn.addEventListener("click", () => {
    try {
        const newModel = JSON.parse(cm.getValue());
        model = newModel;
        repaint();
        showAlert("Изменения применены!");
        codeError.classList.add("d-none");
        mainTabs.show();
        autoSave();
    } catch (e) {
        codeError.textContent = "Не удалось применить, неверный JSON: " + e.message;
        codeError.classList.remove("d-none");
    }
});
