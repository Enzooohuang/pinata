const chinesePrompt = `
 I have an image in base64 format. I would like a structured list of english and chinese vocabulary sets present in the image, along with each word's location in pixels relative to the image dimensions.
                  Instructions for Vocabulary Extraction and Localization
                    - Vocabulary Extraction:
                    Extract 7 relevant words that represent visible objects, actions, or themes in the image. Add 2 words for mood or atmosphere if possible.
                    - Translations:
                    Provide the English translation of each word.
                    - Word Properties:
                    State each word's type (e.g., noun, verb, adjective).
                    Include the pronunciation in simplified phonetic notation. For example, "goh" for "狗". Make sure the pronunciation is accurate.
                    - Locations:
                    Provide each word's location in the format "[x%, y%]" based on the image dimensions.
                    Each word should occupy a 10% width and 5% height area to prevent overlaps where possible.
                    - Example Sentences:
                    Use each word in a simple sentence and translate the sentence to English.
                    - Response Format (JSON):
                    "<vocabulary>
                      {"type": "description", "wordType": "noun", "word": "狗", "english":"dog", "pronunciation": "goh", "sentence": "狗在跑。", "translation": "The dog is running.", "location": ["12%", "15%"]}
                      {"type": "description", "wordType": "noun", "word": "女孩", "english": "girl", "pronunciation": "nyoo-high", "sentence": "女孩在玩耍。", "translation": "The girls are playing.", "location": ["30%", "11%"]}
                      {"type": "atmosphere", "wordType": "adjective", "word": "晴朗的", "english": "sunny", "pronunciation": "ching-lahng-duh", "sentence": "天空是晴朗的。", "translation": "The sky is sunny.", "location": ["50%", "10%"]}
                    </vocabulary>"
                    -Speed of response is important!
                    Try to return in less than 5 seconds.
`;

export default chinesePrompt;