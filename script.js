document.addEventListener('DOMContentLoaded', () => {
    // --- 1. GET PARAMETERS & API KEY ---
    const apiKey = sessionStorage.getItem('geminiApiKey');
    const params = new URLSearchParams(window.location.search);
    const config = {
        title: params.get('title'),
        level: params.get('level'),
        wordCount: params.get('wordCount'),
        style: params.get('style'),
        structure: params.get('structure'),
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
        elementToUpdate.innerHTML = '<div class="skeleton-loader"></div>';
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
            let text = data.candidates[0].content.parts[0].text;
            text = text.replace(/```json\n?|\n?```/g, '').trim();
            elementToUpdate.innerHTML = text;
            return text;

        } catch (error) {
            console.error('Gemini API Error:', error);
            elementToUpdate.innerHTML = `<p style="color: red;">生成失敗：${error.message}</p>`;
            return null;
        }
    }

    // --- 3. DYNAMICALLY BUILD THE PAGE CONTENT ---
    function buildPage() {
        document.getElementById('comp-title').textContent = config.title;
        const detailsBar = document.getElementById('comp-details');
        detailsBar.innerHTML = `
            <span>${config.level}</span>
            <span>${config.wordCount}</span>
            <span>${config.style}</span>
            <span>${config.structure}</span>
        `;

        const guidanceContainer = document.getElementById('guidance-columns');
        const guidanceMap = {
            phrases: { title: '建議詞彙', options: config.phrases },
            sentenceStyles: { title: '建議句型', options: config.sentenceStyles },
            rhetoric: { title: '建議修辭', options: config.rhetoric }
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

    async function generateParagraphStarters() {
        const prompt = `你是一位臺灣國小作文老師。請根據以下設定，分四段簡單說明作文結構。
        - 作文題目: "${config.title}"
        - 學生年級: ${config.level}
        - 作文結構: ${config.structure}
        - 文體: ${config.style}
        請分四段簡單說明作文結構，每段間隔一行，不要有其他說明。`;
        await callGemini(prompt, document.getElementById('paragraph-starters'));
    }

    async function generateWritingStarters() {
        let optionalPrompts = '';
        if (config.phrases) optionalPrompts += `- 建議詞彙: ${config.phrases.join('、')}\n`;
        if (config.sentenceStyles) optionalPrompts += `- 建議句型: ${config.sentenceStyles.join('、')}\n`;
        if (config.rhetoric) optionalPrompts += `- 建議修辭: ${config.rhetoric.join('、')}\n`;
        
        const prompt = `你是一位臺灣國小作文老師。請根據以下設定，分四段簡單說明作文結構。
        - 作文題目: "${config.title}"
        - 學生年級: ${config.level}
        - 作文結構: ${config.structure}
        - 文體: ${config.style}
        ${optionalPrompts}
        請用JSON格式輸出一個包含四個句子的陣列，例如: ["句子一", "句子二", "句子三", "句子四"]。不要有其他說明。`;

        const sentencesText = await callGemini(prompt, document.createElement('div')); // Use a dummy element
        if (sentencesText) {
            try {
                const sentences = JSON.parse(sentencesText);
                if (Array.isArray(sentences) && sentences.length === 4) {
                    for (let i = 0; i < 4; i++) {
                        document.getElementById(`paragraph-${i + 1}-input`).value = sentences[i];
                    }
                    updateWordCount(); // Update count after populating textareas
                }
            } catch (e) {
                console.error("Failed to parse starting sentences:", e);
            }
        }
    }

    async function generateExamples(type) {
        const item = {
            phrases: { title: '建議詞彙', options: config.phrases },
            sentenceStyles: { title: '建議句型', options: config.sentenceStyles },
            rhetoric: { title: '建議修辭', options: config.rhetoric }
        }[type];

        if (!item || !item.options) return;

        const prompt = `你是一位台灣國小作文老師，正在為${config.level}的學生說明寫作。
        - 作文題目: "${config.title}"
        - 我需要你針對以下的「${item.title}」，為「每一個項目」各產生一個簡單清楚的範例句子。句子內容請盡量與作文題目有關。
        - 項目列表: ${item.options.join('、')}
        請用項目符號列表，清楚呈現每个項目的範例句。`;
        await callGemini(prompt, document.getElementById(`${type}-output`));
    }
    
async function evaluateParagraph(paragraphNum, paragraphText) {
        const feedbackElement = document.getElementById(`paragraph-${paragraphNum}-feedback`);
        if (!paragraphText.trim()) {
            feedbackElement.innerHTML = "請先輸入內容再進行評量。";
            return;
        }

        // UPDATED PROMPT WITH DETAILED SCORING
        const prompt = `你是一位友善且鼓勵學生的台灣國小作文老師。請根據作文的整體設定，評量學生寫的**單一段落**。
        ### 作文整體設定:
        - 作文題目: "${config.title}"
        - 學生年級: ${config.level}
        - 作文結構: ${config.structure}
        - 文體: ${config.style}
        
        ### 學生寫的段落 (這是第 ${paragraphNum} 段):
        \`\`\`
        ${paragraphText}
        \`\`\`
        
        ### 你的任務:
        請根據以下四個標準給予回饋，並為「每一個標準」及「綜合表現」各提供一個分數(1-6分)。請用鼓勵的語氣，並提供具體、適合該年級學生的建議。
        1.  **立意取材**: 內容是否切題、具體、有創意。
        2.  **結構組織**: 在這個段落中的句子安排是否流暢。
        3.  **遣詞造句**: 用詞是否精確、句子是否通順。
        4.  **錯別字、標點符號**: 檢查基本的書寫錯誤。
        
        ### 輸出格式:
        請嚴格依照以下格式回覆，使用繁體中文：
        **綜合評分：** [請填寫1-6分]
        ---
        **各項分析：**
        - **立意取材：** [請填寫1-6分]
        - **結構組織：** [請填寫1-6分]
        - **遣詞造句：** [請填寫1-6分]
        - **錯別字、標點符號：** [請填寫1-6分]
        ---
        **文章優點：**
        - [條列式說明優點]
        **改進建議：**
        - [條列式說明建議]`;
        
        await callGemini(prompt, feedbackElement);
    }

    async function generateFullComposition() {
        let optionalPrompts = '';
        if (config.phrases) optionalPrompts += `- 請在文章中融入一些建議詞彙，如: ${config.phrases.join('、')}\n`;
        if (config.sentenceStyles) optionalPrompts += `- 請在文章中展示不同的句型，如: ${config.sentenceStyles.join('、')}\n`;
        if (config.rhetoric) optionalPrompts += `- 請在文章中使用以下修辭: ${config.rhetoric.join('、')}\n`;

        const prompt = `你是一位優秀的作家，請為一位台灣的${config.level}學生，根據以下所有要求，寫一篇流暢且完整的作文。
        - 作文題目: "${config.title}"
        - 字數要求: 接近 ${config.wordCount}，但不要超過。
        - 文體: ${config.style}
        - 結構: ${config.structure}
        ${optionalPrompts}
        - 第一行題目需置中，文章需分段清楚，每段前面需空兩個國字，內容具體，用詞適合國小學生理解。請直接開始寫作，不要有任何前言或結語。`;
        
        await callGemini(prompt, document.getElementById('full-composition-output'));
    }

    // --- 5. WORD COUNTER LOGIC ---
    const wordCountLimit = parseInt(config.wordCount.match(/\d+/)[0], 10);
    const wordCounterElement = document.getElementById('word-counter');
    const textareas = document.querySelectorAll('.writing-textarea');

    function updateWordCount() {
        let totalWords = 0;
        textareas.forEach(textarea => {
            totalWords += textarea.value.length;
        });
        wordCounterElement.textContent = `總字數：${totalWords} / ${wordCountLimit}`;
        if (totalWords > wordCountLimit) {
            wordCounterElement.style.color = 'red';
            wordCounterElement.style.fontWeight = 'bold';
        } else {
            wordCounterElement.style.color = '';
            wordCounterElement.style.fontWeight = '';
        }
    }

    // --- 6. INITIALIZE THE PAGE AND ADD EVENT LISTENERS ---
    buildPage();
    generateParagraphStarters();
    generateWritingStarters(); // New function call

    document.getElementById('guidance-columns').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.type) {
            generateExamples(e.target.dataset.type);
        }
    });

    document.getElementById('generate-full-comp-btn').addEventListener('click', generateFullComposition);

    // Listener for the new writing section
    document.getElementById('writing-section').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.paragraph) {
            const paragraphNum = e.target.dataset.paragraph;
            const paragraphText = document.getElementById(`paragraph-${paragraphNum}-input`).value;
            evaluateParagraph(paragraphNum, paragraphText);
        }
    });
    
    // Listener for word counting
    textareas.forEach(textarea => {
        textarea.addEventListener('input', updateWordCount);
    });
    updateWordCount(); // Initial count
});