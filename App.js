import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, PanResponder, Animated, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect, useRef } from 'react';
import { OPENAI_API_KEY } from '@env';
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from 'expo-media-library';
import logo from './assets/logo.png';
import logoFull from './assets/logofull.png';

const Stack = createNativeStackNavigator();
const screenWidth = Dimensions.get('window').width;

// Add this interface at the top of the file
const parseVocabularyData = (response) => {
  try {
    const match = response.match(/<vocabulary>([\s\S]*?)<\/vocabulary>/);
    if (match && match[1]) {
      const vocabularyItems = match[1]
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          const cleanedLine = line.replace(/(\d+)px/g, '$1');
          const parsedItem = JSON.parse(cleanedLine);
          // Parse word conjugations into an array
          if (parsedItem.wordConjugation) {
            parsedItem.wordConjugation = parsedItem.wordConjugation
              .replace('[', '')
              .replace(']', '')
              .split(', ');
          }
          return parsedItem;
        });
      return vocabularyItems;
    }
    return null;
  } catch (error) {
    console.error('Error parsing vocabulary data:', error);
    return null;
  }
};

// Home Screen Component
function HomeScreen({ navigation }) {
  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }

      // Pick the image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 1,
        base64: true,
      });

      if (!result.canceled) {
        // Navigate to result screen with base64 data
        navigation.navigate('Result', { 
          imageBase64: result.assets[0].base64,
          imageUri: result.assets[0].uri
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Error picking image: ' + error.message);
    }
  };

  const takePhoto = async () => {
    try {
      // Request camera permission
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 1,
        base64: true,
      });

      if (!result.canceled) {
        navigation.navigate('Result', { 
          imageBase64: result.assets[0].base64,
          imageUri: result.assets[0].uri
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      alert('Error taking photo: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('./assets/logohome.png')}
        style={styles.homeLogo}
      />
      <TouchableOpacity 
        style={[styles.button, styles.libraryButton]}
        onPress={pickImage}
      >
        <Text style={styles.buttonText}>Select from Library</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.cameraButton]}
        onPress={takePhoto}
      >
        <Text style={styles.buttonText}>Take Photo</Text>
      </TouchableOpacity>
    </View>
  );
}

// Result Screen Component
function ResultScreen({ route, navigation }) {
  const { imageBase64, imageUri } = route.params;
  const [imageHeight, setImageHeight] = useState(0);
  const [imageWidth, setImageWidth] = useState(0);
  const [gptResponse, setGptResponse] = useState('');
  const [vocabularyData, setVocabularyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zIndexOrder, setZIndexOrder] = useState([]);  // Track order of markers
  const [markers, setMarkers] = useState([]);
  const [isDragging, setIsDragging] = useState(false);  // Add this state
  const viewShotRef = useRef();
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    Image.getSize(imageUri, (width, height) => {
      const scaledHeight = (height / width) * screenWidth;
      setImageHeight(scaledHeight);
      setImageWidth(screenWidth);
    });
  }, [imageUri]);

  const callChatGPT = async () => {
    try {
      const result = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant that can analyze images and provide a list of vocabulary words in english and spanish.`
            },
            {
              role: 'user',
              content: [
                {type: 'image_url', image_url: {url: `data:image/jpeg;base64,${imageBase64}`}},
                {type: 'text', text: `
                  I have an image in base64 format. I would like a structured list of english and spanish vocabulary sets present in the image, along with each word's location in pixels relative to the image dimensions.

                    Please follow these instructions:

                    1. **Vocabulary Extraction**: 
                      - Identify the most relevant vocabulary words based on visible objects, actions, or key elements in the image. Examples might include words like "perro", "césped", or "alegría" if the image depicts a dog in a park.
                      - Include two words that convey the overall mood or atmosphere of the image, such as "soleado" or "tranquilo".

                    2. **Word translations**:
                      - Include the english translation of each word. For example, if the word is "perro", the translation should be "dog".

                    3. **Word conjugations**:
                      - Include the conjugation of the word in the different tenses, for example if the word is "comer", the conjugations should be "como", "comes", "comió", etc.
                      - If the word is adjective, include the different forms of the adjective, for example if the word is "grande", the conjugations should be "grande", "grandes", "grandezas", etc.
                      - If the word is a noun, include the different forms of the noun, for example if the word is "perro", the conjugations should be "perro", "perros", etc.

                    4. **Word types**:
                      - Include the type of the word, for example "verb", "noun", "adjective", "adverb", etc.
                      
                    5. **Word Locations**:
                      - Provide each word's **location as a percentage** of the image dimensions, in the format "[x%, y%]", where "x" and "y" are percentages relative to the image width and height, respectively.
                      - Ensure that locations do not overlap. Each word should have a **10% width and 5% height area** for placement, avoiding overlaps if possible.
                    
                    6. **Example Sentence of Keywords**: 
                      - Include a sentence that includes the keyword, for example if the keyword is "perro", the sentence could be "El perro feo corre en el patio grande". Try not to use the conjugations of the word in the sentence.
                      - Also include the english translation of the sentence, for example "The ugly dog runs in the big yard", better to use the word translated in #2 in the sentence.

                    7. **Response Format**:
                      - Structure your response in "<vocabulary>" tags with each entry as a JSON object.
                      - Use this format:
                        <vocabulary>
                          {"type": "description", "wordType": "noun", "spanish": "perro", "engli ssh":"dog", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
                          {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
                        </vocabulary>

                    ### Example Response:
                    If the image depicts a dog in a park:
                    <vocabulary> 
                      {"type": "description", "wordType": "noun", "spanish": "perro", "english":"dog", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
                      {"type": "description", "wordType": "noun", "spanish": "césped", "english": "grass", "wordConjugation": "[céspedes]", "sentence": "El césped es verde", "translation": "The grass is green", "location": ["22.4%", "24%"]} 
                      {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
                      {"type": "description", "wordType": "noun", "spanish": "alegría", "english": "happy", "wordConjugation": "[alegrias]", "sentence": "La alegria es intensa", "translation": "The joy is intense", "location": ["42%", "37.4%"]} 
                      {"type": "atmosphere", "wordType": "adjective", "spanish": "soleado", "english": "sunny", "wordConjugation": "[soleada, soledad, soledades]", "sentence": "El día está soleado", "translation": "The day is sunny", "location": ["50%", "10%"]} 
                      {"type": "atmosphere", "wordType": "noun", "spanish": "delicioso", "english": "delightful", "wordConjugation": "[deliciosa, deliciosos, deliciosas]", "sentence": "Olamos nosotros ese delicioso pastel", "translation": "We eat that delicious cake", "location": ["60%", "15%"]} 
                    </vocabulary>`}
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.5,
        }),
      });

      const data = await result.json();
      if (data.choices && data.choices.length > 0) {
        const response = data.choices[0].message.content;
        console.log('ChatGPT response:', response);
        setGptResponse(response);
        
        // Parse the vocabulary data
        const parsedData = parseVocabularyData(response);
        if (parsedData) {
          setVocabularyData(parsedData);
        }
      } else {
        setGptResponse('No response from API.');
      }
    } catch (error) {
      setGptResponse('Error calling ChatGPT API: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // callChatGPT();
    const response = `
        <vocabulary> 
          {"type": "description", "wordType": "noun", "spanish": "perro", "english":"dog", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
          {"type": "description", "wordType": "noun", "spanish": "césped", "english": "grass", "wordConjugation": "[céspedes]", "sentence": "El césped es verde", "translation": "The grass is green", "location": ["22.4%", "24%"]} 
          {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
          {"type": "description", "wordType": "noun", "spanish": "alegría", "english": "happy", "wordConjugation": "[alegrias]", "sentence": "La alegria es intensa", "translation": "The joy is intense", "location": ["42%", "37.4%"]} 
          {"type": "atmosphere", "wordType": "adjective", "spanish": "soleado", "english": "sunny", "wordConjugation": "[soleada, soledad, soledades]", "sentence": "El día está soleado", "translation": "The day is sunny", "location": ["50%", "10%"]} 
          {"type": "atmosphere", "wordType": "noun", "spanish": "delicioso", "english": "delightful", "wordConjugation": "[deliciosas]", "sentence": "Olamos nosotros ese delicioso pastel", "translation": "We eat that delicious cake", "location": ["60%", "15%"]} 
        </vocabulary>
    `;
    const parsedData = parseVocabularyData(response);
    if (parsedData) {
      setVocabularyData(parsedData);
    }
    setLoading(false);
  }, [imageBase64, imageUri]);

  useEffect(() => {
    if (vocabularyData) {
      setZIndexOrder(vocabularyData.map((_, index) => index));
      // Initialize markers with position and pan animation
      const newMarkers = vocabularyData.map((item) => ({
        ...item,
        pan: new Animated.ValueXY(),
        position: getPixelPosition(item.location)
      }));
      setMarkers(newMarkers);
    }
  }, [vocabularyData, imageWidth, imageHeight]);

  const bringToFront = (index) => {
    setZIndexOrder(prevOrder => {
      const newOrder = prevOrder.filter(i => i !== index);
      return [...newOrder, index];  // Add the clicked index to the end (top)
    });
  };

  const getPixelPosition = (percentageLocation) => {
    // Remove the % sign and convert to number
    const x = parseFloat(percentageLocation[0].replace('%', ''));
    const y = parseFloat(percentageLocation[1].replace('%', ''));
    
    // Define marker dimensions
    const MARKER_WIDTH = 100;  // minWidth of marker
    const MARKER_HEIGHT = 60;  // approximate height with padding and text
    
    // Calculate position while keeping markers inside bounds
    const left = Math.min(
      Math.max(MARKER_WIDTH/2, (x / 100) * imageWidth),
      imageWidth - MARKER_WIDTH/2
    );
    
    const top = Math.min(
      Math.max(MARKER_HEIGHT/2, (y / 100) * imageHeight),
      imageHeight - MARKER_HEIGHT/2
    );
    
    return { left, top };
  };

  const createPanResponder = (index) => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        bringToFront(index);
      },
      onPanResponderMove: (_, gesture) => {

        setIsDragging(true);
        const marker = markers[index];
        
        // Calculate new position including the transform offset
        const newX = Math.min(
          Math.max(50, marker.position.left + gesture.dx),
          imageWidth - 50
        );
        const newY = Math.min(
          Math.max(30, marker.position.top + gesture.dy),
          imageHeight - 30
        );
        
        // Create new markers array with updated position
        const newMarkers = markers.map((m, i) => {
          if (i === index) {
            const updatedMarker = {
              ...m,
              position: { left: newX, top: newY }
            };
            // Important: Create a new Animated.ValueXY for the updated marker
            updatedMarker.pan = new Animated.ValueXY();
            return updatedMarker;
          }
          return m;
        });
        
        // Update markers state with the new array
        setMarkers(newMarkers);
      },
      onPanResponderEnd: (_, gesture) => {
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      }
    });
  };

  const captureAndShare = async () => {
    try {
      setIsCapturing(true);  // Show header before capture
      
      // Wait a moment for the header to render
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture the view
      const result = await viewShotRef.current.capture({
        format: "jpg",
        quality: 0.8,
      });

      setIsCapturing(false);  // Hide header after capture

      // Share the image
      await Share.share({
        url: result,
        message: 'Check out my vocabulary from Pinata!',
      });
    } catch (error) {
      setIsCapturing(false);  // Make sure to hide header if there's an error
      console.error('Error sharing image:', error);
      alert('Failed to share image.');
    }
  };

  // Set up the header button when component mounts
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={captureAndShare}
          style={{ marginRight: 15 }}
        >
          <Image 
            source={require('./assets/share.png')}  // Make sure to add a share icon to your assets
            style={{ width: 18, height: 20 }}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={styles.scrollView} 
        scrollEnabled={!isDragging}
      >
        <ViewShot 
          ref={viewShotRef}
          options={{ 
            format: "jpg", 
            quality: 0.8,
          }}
        >
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUri }}
              style={[styles.image, { height: imageHeight }]}
            />
            {markers.map((item, index) => {
              const panResponder = createPanResponder(index);
              return (
                <Animated.View 
                  key={index}
                  {...panResponder.panHandlers}
                  style={[
                    styles.vocabularyMarker,
                    {
                      left: item.position.left,
                      top: item.position.top,
                      zIndex: zIndexOrder.indexOf(index) + 1,
                      elevation: zIndexOrder.indexOf(index) + 1,
                      transform: [
                        { translateX: item.pan.x },
                        { translateY: item.pan.y },
                        { translateX: -50 },
                        { translateY: -30 }
                      ]
                    }
                  ]}
                >
                  <View style={styles.markerContent}>
                    <Text style={styles.vocabularyWord}>{item.spanish}</Text>
                    <Text style={styles.vocabularyType}>{item.english}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
          <View style={styles.gptContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#007AFF" style={{ padding: 20 }}/>
            ) : vocabularyData && vocabularyData.length > 0 ? (
              <View style={styles.vocabularyContainer}>
                {vocabularyData.map((item, index) => (
                  <View key={index} style={styles.vocabularyItem}>
                    <Text style={styles.vocabularyText}>
                      <Text style={[styles.vocabularyText, styles.mainText]}>{item.spanish}</Text>
                      <Text style={[styles.vocabularyText, styles.regularText]}> - {item.english}</Text>
                      <Text style={[styles.vocabularyText, styles.smallText]}> ({item.wordType})</Text>
                    </Text>
                    <Text style={styles.vocabularyText}>
                    {item.wordConjugation
                      .map((conjugation, i) => (
                        i === 0 ? (
                          <Text key={i} style={styles.conjugationText}>
                            {conjugation}
                          </Text>
                        ) : (
                          <Text key={i} style={styles.conjugationText}>
                            {' '}/ {conjugation}
                          </Text>
                        )
                      ))
                    }
                    </Text>
                    <Text>
                    <Text style={styles.vocabularyText}>
                      e.g. {
                        item.sentence.split(new RegExp(`(${[item.spanish, ...item.wordConjugation].join('|')})`, 'gi'))
                        .map((part, i) => (
                          [item.spanish, ...item.wordConjugation].some(word => 
                            word.toLowerCase() === part.toLowerCase()
                          )
                            ? <Text key={i} style={styles.boldText}>{part}</Text>
                            : part
                        ))
                      }
                    </Text>
                    <Text style={[styles.vocabularyText, styles.conjugationText]}>
                      {' ('}{
                        item.translation.split(new RegExp(`(${item.english})`, 'gi'))
                        .map((part, i) => (
                          part.toLowerCase() === item.english.toLowerCase()
                            ? <Text key={i} style={styles.boldText}>{part}</Text>
                            : part
                        ))
                      }{')'}
                    </Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.errorText}>Could not parse vocabulary data</Text>
            )}
          </View>
          {isCapturing && (  // Only show header when capturing
            <View style={styles.captureHeader}>
              <Text style={styles.captureHeaderText}>Created by </Text>
              <Image
                source={logoFull}
                style={styles.captureHeaderLogo}
              />
            </View>
          )}
        </ViewShot>
      </ScrollView>
    </View>
  );
}

// Main App Component
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{
            headerTitle: () => (
              <Image
                source={logo}
                style={{ width: 90, height: 30, resizeMode: 'contain' }}
              />
            ),
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen 
          name="Result" 
          component={ResultScreen} 
          options={{
            headerTitle: () => (
              <Image
                source={logo}
                style={{ width: 90, height: 30, resizeMode: 'contain' }}
              />
            ),
            headerTitleAlign: 'center',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 20,
    backgroundColor: '#fff',  // Ensure white background
  },
  scrollView: {
    flex: 1,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    width: '80%',
  },
  libraryButton: {
    backgroundColor: '#7744C2',
  },
  cameraButton: {
    backgroundColor: '#D43C8F',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  image: {
    width: screenWidth,
    resizeMode: 'contain',
  },
  gptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  gptResponse: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    fontSize: 14,
    lineHeight: 20,
  },
  imageContainer: {
    position: 'relative',
    width: screenWidth,
  },
  vocabularyMarker: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 10,
    borderRadius: 8,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(5px)',
  },
  markerContent: {
    alignItems: 'center',
    width: '100%',
  },
  vocabularyWord: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vocabularyType: {
    color: '#333',
    fontSize: 12,
    fontStyle: 'italic',
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vocabularyContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 10,
    borderRadius: 10,
  },
  vocabularyItem: {
    marginTop: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  vocabularyText: {
    fontSize: 14,
    marginBottom: 5,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#007AFF',  // Using iOS blue color for emphasis
  },
  conjugationContainer: {
    marginLeft: 10,
    marginBottom: 10,
  },
  conjugationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    marginTop: 2,
  },
  mainText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  regularText: {
    fontWeight: 'normal',
    fontSize: 16,
  },
  smallText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  homeLogo: {
    width: screenWidth * 0.7,  // 70% of screen width
    height: screenWidth * 0.7,  // Maintain aspect ratio
    resizeMode: 'contain',
    marginBottom: 40,  // Space between logo and buttons
  },
  captureHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  captureHeaderLogo: {
    width: 150,
    height: 90,
    resizeMode: 'contain',
    marginRight: 10,
  },
  captureHeaderText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
});
