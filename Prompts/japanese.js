const japanesePrompt = `
I have an image in base64 format. I would like a structured list of english and japanese vocabulary sets present in the image, along with each word's location in pixels relative to the image dimensions. 
                  Instructions for Vocabulary Extraction and Localization
                    - Vocabulary Extraction:
                    Extract 7 relevant words that represent visible objects, actions, or themes in the image. Add 2 words for mood or atmosphere if possible.
                    - Translations:
                    Provide the English translation of each word.
                    - Word Variations:
                    For verbs, provide common conjugations. For adjectives and nouns, provide plural or feminine/masculine forms if applicable.
                    - Word Properties:
                    State each word's type (e.g., noun, verb, adjective).
                    Include the pronunciation in simplified phonetic notation.
                    - Locations:
                    Provide each word's location in the format "[x%, y%]" based on the image dimensions.
                    Each word should occupy a 10% width and 5% height area to prevent overlaps where possible.
                    - Example Sentences:
                    Use each word in a simple sentence and translate the sentence to English.
                    - Response Format (JSON):
                    "<vocabulary>
                      {"type": "description", "wordType": "noun", "word": "犬", "english":"dog", "pronunciation": "in-do", "conjugations": ["いぬ"], "sentence": "犬が走っている。", "translation": "The dog is running.", "location": ["12%", "15%"]}
                      {"type": "atmosphere", "wordType": "adjective", "word": "晴れ", "english": "sunny", "pronunciation": "hah-reh", "conjugations": ["は-れる", "は-れた", "は-れている"], "sentence": "晴れている。", "translation": "The day is sunny.", "location": ["50%", "10%"]}
                    </vocabulary>"
`;

export default japanesePrompt;