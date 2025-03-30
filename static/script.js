document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('data-section');
            
            // Update active nav link
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            this.classList.add('active');
            
            // Show target section
            sections.forEach(section => section.classList.remove('active'));
            document.getElementById(targetSection).classList.add('active');
            
            // Refresh context files list when switching to editor tab
            if (targetSection === 'editor') {
                updateContextFilesCheckboxes();
                updateSummarizedContextFilesCheckboxes();
            }
        });
    });

    // Settings
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const secondaryModelSelect = document.getElementById('secondary-model-select');
    const temperatureSlider = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature-value');
    const topPSlider = document.getElementById('top-p');
    const topPValue = document.getElementById('top-p-value');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Update slider values
    temperatureSlider.addEventListener('input', function() {
        temperatureValue.textContent = this.value;
    });

    topPSlider.addEventListener('input', function() {
        topPValue.textContent = this.value;
    });

    // Load settings
    function loadSettings() {
        fetch('/api/config')
            .then(response => response.json())
            .then(config => {
                apiKeyInput.value = config.api_key || '';
                modelSelect.value = config.model || 'gemini-pro';
                secondaryModelSelect.value = config.secondary_model || 'gemini-2.0-flash';
                temperatureSlider.value = config.temperature || 0.7;
                temperatureValue.textContent = temperatureSlider.value;
                topPSlider.value = config.top_p || 0.95;
                topPValue.textContent = topPSlider.value;
            })
            .catch(error => console.error('Error loading settings:', error));
    }

    // Save settings
    saveSettingsBtn.addEventListener('click', function() {
        const config = {
            api_key: apiKeyInput.value,
            model: modelSelect.value,
            secondary_model: secondaryModelSelect.value,
            temperature: temperatureSlider.value,
            top_p: topPSlider.value
        };

        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('설정이 저장되었습니다.');
            } else {
                alert('설정 저장에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error saving settings:', error);
            alert('설정 저장 중 오류가 발생했습니다.');
        });
    });

    // File Management
    const fileList = document.getElementById('file-list');
    const newFileNameInput = document.getElementById('new-file-name');
    const createFileBtn = document.getElementById('create-file-btn');
    const fileContentTextarea = document.getElementById('file-content');
    const currentFileName = document.getElementById('current-file-name');
    const saveFileBtn = document.getElementById('save-file-btn');
    const deleteFileBtn = document.getElementById('delete-file-btn');
    const summarizeFileBtn = document.getElementById('summarize-file-btn');

    let selectedFile = null;
    let selectedFiles = new Set();
    let selectedSummarizedFiles = new Set();

    // Load file list
    function loadFileList() {
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                if (files.length === 0) {
                    fileList.innerHTML = '<p>저장된 파일이 없습니다.</p>';
                    return;
                }

                fileList.innerHTML = '';
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.dataset.filename = file;
                    fileItem.draggable = true;
                    
                    const fileNameSpan = document.createElement('span');
                    fileNameSpan.textContent = file;
                    
                    const fileItemActions = document.createElement('div');
                    fileItemActions.className = 'file-item-actions';
                    
                    const selectForContextBtn = document.createElement('button');
                    selectForContextBtn.textContent = '컨텍스트에 추가';
                    selectForContextBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        toggleFileForContext(file);
                    });
                    
                    const selectForSummarizedContextBtn = document.createElement('button');
                    selectForSummarizedContextBtn.textContent = '요약 컨텍스트에 추가';
                    selectForSummarizedContextBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        toggleFileForSummarizedContext(file);
                    });
                    
                    fileItemActions.appendChild(selectForContextBtn);
                    fileItemActions.appendChild(selectForSummarizedContextBtn);
                    fileItem.appendChild(fileNameSpan);
                    fileItem.appendChild(fileItemActions);
                    
                    fileItem.addEventListener('click', function() {
                        loadFileContent(file);
                    });
                    
                    // Drag and drop events
                    fileItem.addEventListener('dragstart', handleDragStart);
                    fileItem.addEventListener('dragover', handleDragOver);
                    fileItem.addEventListener('dragleave', handleDragLeave);
                    fileItem.addEventListener('drop', handleDrop);
                    fileItem.addEventListener('dragend', handleDragEnd);
                    
                    fileList.appendChild(fileItem);
                });
                
                // Update context files checkboxes
                updateContextFilesCheckboxes();
                updateSummarizedContextFilesCheckboxes();
            })
            .catch(error => {
                console.error('Error loading file list:', error);
                fileList.innerHTML = '<p>파일 목록을 불러오는 중 오류가 발생했습니다.</p>';
            });
    }
    
    // Drag and drop handlers
    let draggedItem = null;
    
    function handleDragStart(e) {
        this.classList.add('dragging');
        draggedItem = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.dataset.filename);
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
        return false;
    }
    
    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }
    
    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Remove drag-over class
        this.classList.remove('drag-over');
        
        // Don't do anything if dropping the same item we're dragging
        if (draggedItem === this) {
            return false;
        }
        
        // Get all file items as an array
        const items = Array.from(fileList.querySelectorAll('.file-item'));
        const fromIndex = items.indexOf(draggedItem);
        const toIndex = items.indexOf(this);
        
        // Reorder the items in the DOM
        if (fromIndex < toIndex) {
            fileList.insertBefore(draggedItem, this.nextSibling);
        } else {
            fileList.insertBefore(draggedItem, this);
        }
        
        // Save the new order to the server
        saveFileOrder();
        
        return false;
    }
    
    function handleDragEnd() {
        this.classList.remove('dragging');
        document.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    }
    
    // Save file order to server
    function saveFileOrder() {
        const items = Array.from(fileList.querySelectorAll('.file-item'));
        const order = items.map(item => item.dataset.filename);
        
        fetch('/api/files/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ order: order })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error saving file order:', data.error);
            }
        })
        .catch(error => {
            console.error('Error saving file order:', error);
        });
    }

    // Load file content
    function loadFileContent(filename) {
        fetch(`/api/files/${filename}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                
                fileContentTextarea.value = data.content;
                currentFileName.textContent = filename;
                selectedFile = filename;
                
                // Update file item selection
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('selected');
                    if (item.dataset.filename === filename) {
                        item.classList.add('selected');
                    }
                });
                
                // Enable buttons
                fileContentTextarea.disabled = false;
                saveFileBtn.disabled = false;
                deleteFileBtn.disabled = false;
                summarizeFileBtn.disabled = false;
            })
            .catch(error => {
                console.error('Error loading file content:', error);
                alert('파일 내용을 불러오는 중 오류가 발생했습니다.');
            });
    }

    // Create new file
    createFileBtn.addEventListener('click', function() {
        const filename = newFileNameInput.value.trim();
        if (!filename) {
            alert('파일 이름을 입력하세요.');
            return;
        }
        
        // Add .txt extension if not present
        const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
        
        fetch(`/api/files/${finalFilename}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: '' })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`'${finalFilename}' 파일이 생성되었습니다.`);
                newFileNameInput.value = '';
                loadFileList();
                loadFileContent(finalFilename);
            } else {
                alert('파일 생성에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error creating file:', error);
            alert('파일 생성 중 오류가 발생했습니다.');
        });
    });

    // Save file
    saveFileBtn.addEventListener('click', function() {
        if (!selectedFile) return;
        
        fetch(`/api/files/${selectedFile}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: fileContentTextarea.value })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('파일이 저장되었습니다.');
            } else {
                alert('파일 저장에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error saving file:', error);
            alert('파일 저장 중 오류가 발생했습니다.');
        });
    });

    // Delete file
    deleteFileBtn.addEventListener('click', function() {
        if (!selectedFile) return;
        
        if (!confirm(`'${selectedFile}' 파일을 삭제하시겠습니까?`)) return;
        
        fetch(`/api/files/${selectedFile}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('파일이 삭제되었습니다.');
                selectedFile = null;
                currentFileName.textContent = '파일을 선택하세요';
                fileContentTextarea.value = '';
                fileContentTextarea.disabled = true;
                saveFileBtn.disabled = true;
                deleteFileBtn.disabled = true;
                summarizeFileBtn.disabled = true;
                
                // Remove from selected files if present
                if (selectedFiles.has(selectedFile)) {
                    selectedFiles.delete(selectedFile);
                    updateContextFilesCheckboxes();
                }
                
                loadFileList();
            } else {
                alert('파일 삭제에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error deleting file:', error);
            alert('파일 삭제 중 오류가 발생했습니다.');
        });
    });

    // Summarize file
    summarizeFileBtn.addEventListener('click', function() {
        if (!selectedFile) return;
        
        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.classList.remove('hidden');
        
        fetch('/api/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename: selectedFile })
        })
        .then(response => response.json())
        .then(data => {
            loadingIndicator.classList.add('hidden');
            
            if (data.error) {
                alert(data.error);
                return;
            }
            
            alert(`'${data.summary_filename}' 파일로 요약이 저장되었습니다.`);
            loadFileList();
        })
        .catch(error => {
            loadingIndicator.classList.add('hidden');
            console.error('Error summarizing file:', error);
            alert('파일 요약 중 오류가 발생했습니다.');
        });
    });

    // Toggle file for context
    function toggleFileForContext(filename) {
        if (selectedFiles.has(filename)) {
            selectedFiles.delete(filename);
        } else {
            selectedFiles.add(filename);
        }
        updateContextFilesCheckboxes();
    }

    // Toggle file for summarized context
    function toggleFileForSummarizedContext(filename) {
        if (selectedSummarizedFiles.has(filename)) {
            selectedSummarizedFiles.delete(filename);
        } else {
            selectedSummarizedFiles.add(filename);
        }
        updateSummarizedContextFilesCheckboxes();
    }

    // Update context files checkboxes in the editor tab
    function updateContextFilesCheckboxes() {
        const contextFilesList = document.getElementById('context-files-list');
        
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                if (files.length === 0) {
                    contextFilesList.innerHTML = '<p>저장된 파일이 없습니다.</p>';
                    return;
                }
                
                contextFilesList.innerHTML = '';
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'context-file-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `context-${file}`;
                    checkbox.checked = selectedFiles.has(file);
                    checkbox.addEventListener('change', function() {
                        toggleFileForContext(file);
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = `context-${file}`;
                    label.textContent = file;
                    
                    fileItem.appendChild(checkbox);
                    fileItem.appendChild(label);
                    contextFilesList.appendChild(fileItem);
                });
            })
            .catch(error => {
                console.error('Error loading files for context:', error);
                contextFilesList.innerHTML = '<p>파일 목록을 불러오는 중 오류가 발생했습니다.</p>';
            });
    }

    // Update summarized context files checkboxes in the editor tab
    function updateSummarizedContextFilesCheckboxes() {
        const summarizedContextFilesList = document.getElementById('summarized-context-files-list');
        
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                if (files.length === 0) {
                    summarizedContextFilesList.innerHTML = '<p>저장된 파일이 없습니다.</p>';
                    return;
                }
                
                summarizedContextFilesList.innerHTML = '';
                files.forEach(file => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'context-file-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `summarized-context-${file}`;
                    checkbox.checked = selectedSummarizedFiles.has(file);
                    checkbox.addEventListener('change', function() {
                        toggleFileForSummarizedContext(file);
                    });
                    
                    const label = document.createElement('label');
                    label.htmlFor = `summarized-context-${file}`;
                    label.textContent = file;
                    
                    fileItem.appendChild(checkbox);
                    fileItem.appendChild(label);
                    summarizedContextFilesList.appendChild(fileItem);
                });
            })
            .catch(error => {
                console.error('Error loading files for summarized context:', error);
                summarizedContextFilesList.innerHTML = '<p>파일 목록을 불러오는 중 오류가 발생했습니다.</p>';
            });
    }

    // AI Generation
    const systemInstructions = document.getElementById('system-instructions');
    const upperPrompt = document.getElementById('upper-prompt');
    const mainPrompt = document.getElementById('main-prompt');
    const lowerPrompt = document.getElementById('lower-prompt');
    const generateBtn = document.getElementById('generate-btn');
    const responseContainer = document.getElementById('response-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const saveResponseBtn = document.getElementById('save-response-btn');

    // Generate content
    generateBtn.addEventListener('click', function() {
        if (!mainPrompt.value.trim()) {
            alert('메인 프롬프트를 입력하세요.');
            return;
        }
        
        loadingIndicator.classList.remove('hidden');
        responseContainer.textContent = '';
        
        const requestData = {
            system_instructions: systemInstructions.value,
            upper_prompt: upperPrompt.value,
            main_prompt: mainPrompt.value,
            lower_prompt: lowerPrompt.value,
            selected_files: Array.from(selectedFiles),
            selected_summarized_files: Array.from(selectedSummarizedFiles)
        };
        
        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            loadingIndicator.classList.add('hidden');
            
            if (data.error) {
                responseContainer.textContent = `오류: ${data.error}`;
                return;
            }
            
            responseContainer.textContent = data.response;
        })
        .catch(error => {
            loadingIndicator.classList.add('hidden');
            console.error('Error generating content:', error);
            responseContainer.textContent = '콘텐츠 생성 중 오류가 발생했습니다.';
        });
    });

    // Save response
    saveResponseBtn.addEventListener('click', function() {
        const responseText = responseContainer.textContent;
        if (!responseText) {
            alert('저장할 응답이 없습니다.');
            return;
        }
        
        const filename = prompt('파일 이름을 입력하세요 (확장자 .txt 생략 가능):', '');
        if (!filename) return;
        
        const finalFilename = filename.endsWith('.txt') ? filename : `${filename}.txt`;
        
        fetch(`/api/files/${finalFilename}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content: responseText })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`'${finalFilename}' 파일로 응답이 저장되었습니다.`);
                loadFileList();
            } else {
                alert('응답 저장에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error saving response:', error);
            alert('응답 저장 중 오류가 발생했습니다.');
        });
    });

    // Template Management
    const templateSelect = document.getElementById('template-select');
    const loadTemplateBtn = document.getElementById('load-template-btn');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    const deleteTemplateBtn = document.getElementById('delete-template-btn');

    // Load template list
    function loadTemplateList() {
        fetch('/api/templates')
            .then(response => response.json())
            .then(templates => {
                // Clear existing options except the first one
                while (templateSelect.options.length > 1) {
                    templateSelect.remove(1);
                }
                
                // Add templates to dropdown
                templates.forEach(template => {
                    const option = document.createElement('option');
                    option.value = template;
                    option.textContent = template.replace('.json', '');
                    templateSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading templates:', error);
            });
    }

    // Load template
    loadTemplateBtn.addEventListener('click', function() {
        const templateName = templateSelect.value;
        if (!templateName) {
            alert('템플릿을 선택하세요.');
            return;
        }
        
        fetch(`/api/templates/${templateName}`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                
                systemInstructions.value = data.system_instructions || '';
                upperPrompt.value = data.upper_prompt || '';
                lowerPrompt.value = data.lower_prompt || '';
                
                alert('템플릿이 로드되었습니다.');
            })
            .catch(error => {
                console.error('Error loading template:', error);
                alert('템플릿 로드 중 오류가 발생했습니다.');
            });
    });

    // Save template
    saveTemplateBtn.addEventListener('click', function() {
        const templateName = prompt('템플릿 이름을 입력하세요:', '');
        if (!templateName) return;
        
        const finalTemplateName = templateName.endsWith('.json') ? templateName : `${templateName}.json`;
        
        const templateData = {
            system_instructions: systemInstructions.value,
            upper_prompt: upperPrompt.value,
            lower_prompt: lowerPrompt.value
        };
        
        fetch(`/api/templates/${finalTemplateName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert(`'${templateName}' 템플릿이 저장되었습니다.`);
                loadTemplateList();
                
                // Select the newly created template
                templateSelect.value = finalTemplateName;
            } else {
                alert('템플릿 저장에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error saving template:', error);
            alert('템플릿 저장 중 오류가 발생했습니다.');
        });
    });

    // Delete template
    deleteTemplateBtn.addEventListener('click', function() {
        const templateName = templateSelect.value;
        if (!templateName) {
            alert('삭제할 템플릿을 선택하세요.');
            return;
        }
        
        if (!confirm(`'${templateName}' 템플릿을 삭제하시겠습니까?`)) return;
        
        fetch(`/api/templates/${templateName}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('템플릿이 삭제되었습니다.');
                loadTemplateList();
                templateSelect.selectedIndex = 0;
            } else {
                alert('템플릿 삭제에 실패했습니다.');
            }
        })
        .catch(error => {
            console.error('Error deleting template:', error);
            alert('템플릿 삭제 중 오류가 발생했습니다.');
        });
    });

    // Initialize
    loadSettings();
    loadFileList();
    updateContextFilesCheckboxes();
    updateSummarizedContextFilesCheckboxes();
    loadTemplateList();
});
