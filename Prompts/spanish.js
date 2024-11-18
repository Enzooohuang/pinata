const spanishPrompt = `I have an image in base64 format. I would like a structured list of english and spanish vocabulary sets present in the image, along with each word's location in pixels relative to the image dimensions. 
Instructions for Vocabulary Extraction and Localization:
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
    {"type": "description", "wordType": "noun", "word": "perro", "english":"dog", "pronunciation": "peh-rroh", "conjugations": ["perros"], "sentence": "El perro corre.", "translation": "The dog runs.", "location": ["12%", "15%"]}
    {"type": "atmosphere", "wordType": "adjective", "word": "soleado", "english": "sunny", "pronunciation": "soh-leh-dah", "conjugations": ["soleada", "soleadas"], "sentence": "El día está soleado.", "translation": "The day is sunny.", "location": ["50%", "10%"]}
  </vocabulary>"
  -Speed of response is important!
  Try to return in less than 5 seconds.`;

export default spanishPrompt;