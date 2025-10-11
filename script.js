document.addEventListener('DOMContentLoaded', () => {
    // --- 1. GET PARAMETERS & API KEY ---
    // Get the API key from sessionStorage instead of the URL
    const apiKey = sessionStorage.getItem('geminiApiKey');
    
    const params = new URLSearchParams(window.location.search);
    const config = {
        // apiKey is now handled separately
        title: params.get('title'),
        level: params.get('level'),
        wordCount: params.get('wordCount'),
        style: params.get('style'),
        structure: params.get('structure'),
        skills: params.get('skills')?.split(','),
        phrases: params.get('phrases')?.split(','),
        sentenceStyles: params.get('sentenceStyles')?.split(','),
        rhetoric: params.get('rhetoric')?.split(',')
    };

    if (!apiKey || !config.title) {
        document.body.innerHTML = '<h1>錯誤：缺少 API Key 或作文題目。請返回上一頁重新設定。</h1>';
        return;
    }

    // --- 2. SETUP THE GEMINI API CALL FUNCTION ---
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    async function callGemini(prompt, elementToUpdate) {
        elementToUpdate.innerHTML = '<div class="skeleton-loader"></div>'; // Show loader
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || `API 請求失敗，狀態碼: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            elementToUpdate.innerHTML = text.replace(/```json\n?|\n?```/g, ''); // Clean up markdown
            return text;

        } catch (error) {
            console.error('Gemini API Error:', error);
            elementToUpdate.innerHTML = `<p style="color: red;">生成失敗：${error.message}</p>`;
            return null;
        }
    }

    // --- 3. DYNAMICALLY BUILD THE PAGE CONTENT ---
    function buildPage() {
        // Set header
        document.getElementById('comp-title').textContent = config.title;
        const detailsBar = document.getElementById('comp-details');
        detailsBar.innerHTML = `
            <span>${config.level}</span>
            <span>${config.wordCount}</span>
            <span>${config.style}</span>
            <span>${config.structure}</span>
        `;

        // Create guidance columns
        const guidanceContainer = document.getElementById('guidance-columns');
        const guidanceMap = {
            skills: { title: '寫作技巧', options: config.skills },
            phrases: { title: '建議詞語', options: config.phrases },
            sentenceStyles: { title: '建議句式', options: config.sentenceStyles },
            rhetoric: { title: '修辭技巧', options: config.rhetoric }
        };

        for (const key in guidanceMap) {
            const item = guidanceMap[key];
            if (item.options && item.options.length > 0) {
                const column = document.createElement('div');
                column.className = 'card';
                column.innerHTML = `
                    <h3>${item.title}</h3>
                    <ul>${item.options.map(opt => `<li>${opt}</li>`).join('')}</ul>
                    <button class="button-secondary" data-type="${key}">生成範例</button>
                    <div class="output-box" id="${key}-output"></div>
                `;
                guidanceContainer.appendChild(column);
            }
        }
    }
    
    // --- 4. DEFINE API PROMPTS AND TRIGGER FUNCTIONS ---

    // Generate Paragraph Starters on page load
    async function generateParagraphStarters() {
        const prompt = `你是一位台灣國小作文老師。請根據以下設定，為一篇四段式作文的「每一個段落」提供一句有啟發性的「開頭句」。
        - 作文題目: "${config.title}"
        - 學生年級: ${config.level}
        - 作文結構: ${config.structure}
        請直接給我四個段落的開頭句，用有序列表格式呈現，不要有其他額外說明。`;
        
        const outputElement = document.getElementById('paragraph-starters');
        await callGemini(prompt, outputElement);
    }

    // Generate examples for guidance columns
    async function generateExamples(type) {
        const item = {
            skills: { title: '寫作技巧', options: config.skills },
            phrases: { title: '建議詞語', options: config.phrases },
            sentenceStyles: { title: '建議句式', options: config.sentenceStyles },
            rhetoric: { title: '修辭技巧', options: config.rhetoric }
        }[type];

        if (!item || !item.options) return;

        const prompt = `你是一位台灣國小作文老師，正在為${config.level}的學生說明寫作。
        - 作文題目: "${config.title}"
        - 我需要你針對以下的「${item.title}」，為「每一個項目」各產生一個簡單清楚的範例句子。句子內容請盡量與作文題目有關。
        - 項目列表: ${item.options.join('、')}
        請用項目符號列表格式，清楚呈現每個項目的範例句。`;
        
        const outputElement = document.getElementById(`${type}-output`);
        await callGemini(prompt, outputElement);
    }

    // Generate the full composition
    async function generateFullComposition() {
        let optionalPrompts = '';
        if (config.skills) optionalPrompts += `- 請特別運用以下寫作技巧: ${config.skills.join('、')}\n`;
        if (config.phrases) optionalPrompts += `- 請在文章中融入一些建議詞語，如: ${config.phrases.join('、')}\n`;
        if (config.sentenceStyles) optionalPrompts += `- 請在文章中展示不同的句式，如: ${config.sentenceStyles.join('、')}\n`;
        if (config.rhetoric) optionalPrompts += `- 請在文章中使用以下修辭技巧: ${config.rhetoric.join('、')}\n`;

        const prompt = `你是一位優秀的作家，請為一位台灣的${config.level}學生，根據以下所有要求，寫一篇流暢且完整的作文。
        - 作文題目: "${config.title}"
        - 字數要求: 接近 ${config.wordCount}，但不要超過。
        - 文體: ${config.style}
        - 結構: ${config.structure}
        ${optionalPrompts}
        - 其他要求: 文章需分段清楚，內容具體，用詞適合國小學生理解。請直接開始寫作，不要有任何前言或結語。`;

        const outputElement = document.getElementById('full-composition-output');
        await callGemini(prompt, outputElement);
    }
    
    // --- 5. INITIALIZE THE PAGE AND ADD EVENT LISTENERS ---
    buildPage();
    generateParagraphStarters();

    document.getElementById('guidance-columns').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.type) {
            generateExamples(e.target.dataset.type);
        }
    });

    document.getElementById('generate-full-comp-btn').addEventListener('click', generateFullComposition);
});