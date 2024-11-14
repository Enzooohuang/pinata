import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, PanResponder, Animated, Share, Easing } from 'react-native';
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
    return [];
  }
};

// Add this new component
function SuccessMessage({ visible, message, onHide, color = 'rgba(212, 60, 143, 0.9)'}) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.successMessage, { opacity: fadeAnim, backgroundColor: color }]}>
      <Text style={styles.successMessageText}>{message}</Text>
    </Animated.View>
  );
}

// Home Screen Component
function HomeScreen({ navigation }) {

  const [showMessage, setShowMessage] = useState(false);
  
  const validateImageDimensions = (width, height) => {
    const aspectRatio = height / width;
    const MAX_RATIO = 16 / 9;
    const MIN_RATIO = 9 / 16;

    if (aspectRatio > MAX_RATIO) {
      console.log('Image is too tall 📏');
      return false;
    }
    if (aspectRatio < MIN_RATIO) {
      console.log('Image is too wide 📏');
      return false;
    }
    return true;
  };

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
        if (!validateImageDimensions(result.assets[0].width, result.assets[0].height)) {
          setShowMessage(true);
          return;
        }
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
      <Text style={styles.taglineText}>
        Turn any moment into
      </Text>
      <Text style={[styles.taglineText, styles.taglineText2]}>
        a Spanish learning opportunity! 🎉
      </Text>
      <TouchableOpacity 
        style={[styles.button, styles.libraryButton]}
        onPress={pickImage}
      >
        <View style={styles.buttonContent}>
          <Image 
            source={require('./assets/image.png')}  // Make sure to add this icon
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>CHOOSE a moment</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.cameraButton]}
        onPress={takePhoto}
      >
        <View style={styles.buttonContent}>
          <Image 
            source={require('./assets/camera.png')}  // Make sure to add this icon
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>CAPTURE a moment</Text>
        </View>
      </TouchableOpacity>
      <SuccessMessage 
        visible={showMessage}
        message={"Oh no! The image either too tall or too wide, please try again with a different image."}
        onHide={() => setShowMessage(false)}
        color={'red'}
      />
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
  const [isEditMode, setIsEditMode] = useState(false);  // Add this state
  const scrollViewRef = useRef();  // Add this ref for ScrollView
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState(null);  // Add this state

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
                      - Identify the 7 most relevant vocabulary words based on visible objects, actions, or key elements in the image. Examples might include words like "perro", "césped", or "alegría" if the image depicts a dog in a park.
                      - Include two words that convey the overall mood or atmosphere of the image, such as "soleado" or "tranquilo".

                    2. **Word translations**:
                      - Include the english translation of each word. For example, if the word is "perro", the translation should be "dog".

                    3. **Word conjugations**:
                      - Include the conjugation of the word in the different tenses, for example if the word is "comer", the conjugations should be "como", "comes", "comió", etc.
                      - If the word is adjective, include the different forms of the adjective, for example if the word is "grande", the conjugations should be "grande", "grandes", "grandezas", etc.
                      - If the word is a noun, include the different forms of the noun, for example if the word is "perro", the conjugations should be "perro", "perros", etc.

                    4. **Word types**:
                      - Include the type of the word, for example "verb", "noun", "adjective", "adverb", etc.

                    5. **Pronunciation**:
                      - include the pronunciation of the word, for example if the word is "perro", the pronunciation should be "peh-rroh", and if the word is "comer", the pronunciation should be "ko-meh-reh".
                      
                    6. **Word Locations**:
                      - Provide each word's **location as a percentage** of the image dimensions, in the format "[x%, y%]", where "x" and "y" are percentages relative to the image width and height, respectively.
                      - Ensure that locations do not overlap. Each word should have a **10% width and 5% height area** for placement, avoiding overlaps if possible.
                      - Try to be as accurate as possible with the location of the words, but if they overlap, try to be as close as possible to the location provided.
                    
                    7. **Example Sentence of Keywords**: 
                      - Include a sentence that includes the keyword, for example if the keyword is "perro", the sentence could be "El perro feo corre en el patio grande". Try not to use the conjugations of the word in the sentence.
                      - Also include the english translation of the sentence, for example "The ugly dog runs in the big yard", better to use the word translated in #2 in the sentence.

                    8. **Response Format**:
                      - Structure your response in "<vocabulary>" tags with each entry as a JSON object.
                      - Use this format:
                        <vocabulary>
                          {"type": "description", "wordType": "noun", "spanish": "perro", "english":"dog", "pronunciation": "peh-rroh", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
                          {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "pronunciation": "ko-meh-reh", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
                        </vocabulary>

                    ### Example Response:
                    If the image depicts a dog in a park:
                    <vocabulary> 
                      {"type": "description", "wordType": "noun", "spanish": "perro", "english":"dog", "pronunciation": "peh-rroh", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
                      {"type": "description", "wordType": "noun", "spanish": "césped", "english": "grass", "pronunciation": "seh-peh-deh", "wordConjugation": "[céspedes]", "sentence": "El césped es verde", "translation": "The grass is green", "location": ["22.4%", "24%"]} 
                      {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "pronunciation": "ko-meh-reh", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
                      {"type": "description", "wordType": "noun", "spanish": "alegría", "english": "happy", "pronunciation": "ah-leh-gria", "wordConjugation": "[alegrias]", "sentence": "La alegria es intensa", "translation": "The joy is intense", "location": ["42%", "37.4%"]} 
                      {"type": "atmosphere", "wordType": "adjective", "spanish": "soleado", "english": "sunny", "pronunciation": "soh-leh-dah", "wordConjugation": "[soleada, soledad, soledades]", "sentence": "El día está soleado", "translation": "The day is sunny", "location": ["50%", "10%"]} 
                      {"type": "atmosphere", "wordType": "noun", "spanish": "delicioso", "english": "delightful", "pronunciation": "deh-lee-choh-soh", "wordConjugation": "[deliciosa, deliciosos, deliciosas]", "sentence": "Olamos nosotros ese delicioso pastel", "translation": "We eat that delicious cake", "location": ["60%", "15%"]} 
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
    callChatGPT();
    // const response = `
    //     <vocabulary> 
    //       {"type": "description", "wordType": "noun", "spanish": "perro", "english":"dog", "wordConjugation": "[perros]", "sentence": "El perro feo corre en el patio grande", "translation": "The ugly dog runs in the big yard", "location": ["12%", "15%"]} 
    //       {"type": "description", "wordType": "noun", "spanish": "césped", "english": "grass", "wordConjugation": "[céspedes]", "sentence": "El césped es verde", "translation": "The grass is green", "location": ["22.4%", "24%"]} 
    //       {"type": "description", "wordType": "verb", "spanish": "correr", "english": "run", "wordConjugation": "[comes, corrió, correrás, corre, corriendo, corremos]", "sentence": "El perro corre en el césped", "translation": "The dog runs in the grass", "location": ["30%", "25%"]} 
    //       {"type": "description", "wordType": "noun", "spanish": "alegría", "english": "happy", "wordConjugation": "[alegrias]", "sentence": "La alegria es intensa", "translation": "The joy is intense", "location": ["42%", "37.4%"]} 
    //       {"type": "atmosphere", "wordType": "adjective", "spanish": "soleado", "english": "sunny", "wordConjugation": "[soleada, soledad, soledades]", "sentence": "El día está soleado", "translation": "The day is sunny", "location": ["50%", "10%"]} 
    //       {"type": "atmosphere", "wordType": "noun", "spanish": "delicioso", "english": "delightful", "wordConjugation": "[deliciosas]", "sentence": "Olamos nosotros ese delicioso pastel", "translation": "We eat that delicious cake", "location": ["60%", "15%"]} 
    //     </vocabulary>
    // `;
    // const parsedData = parseVocabularyData(response);
    // if (parsedData) {
    //   setVocabularyData(parsedData);
    // }
    // setLoading(false);
  }, [imageBase64, imageUri]);

  useEffect(() => {
    if (vocabularyData && markers.length === 0) {  // Only initialize if markers are empty
      setZIndexOrder(vocabularyData.map((_, index) => index));
      const newMarkers = vocabularyData.map((item) => ({
        ...item,
        pan: new Animated.ValueXY(),
        position: getPixelPosition(item.location)
      }));
      setMarkers(newMarkers);
    }
  }, [vocabularyData]);  // Remove imageWidth and imageHeight from dependencies

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
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!isEditMode) return false;
        const { dx, dy } = gesture;
        return Math.abs(dx) > 2 || Math.abs(dy) > 2;
      },
      onPanResponderGrant: () => {
        // Set selected marker on tap
        if (selectedMarker !== index) {
          setSelectedMarker(index);
        } else {
          setSelectedMarker(null);
        }
        bringToFront(index);
        
        if (isEditMode) {
          setIsDragging(true);
        }
      },
      onPanResponderMove: (_, gesture) => {
        if (!isEditMode) return; // Don't move if not in edit mode

        const marker = markers[index];
        
        // Calculate new position including the transform offset
        const newX = Math.min(
          Math.max(50, marker.position.left + gesture.dx),
          imageWidth - 50
        );
        const newY = Math.min(
          Math.max(30, marker.position.top + gesture.dy),
          imageHeight - 50
        );
        
        // Create new markers array with updated position
        const newMarkers = markers.map((m, i) => {
          if (i === index) {
            const updatedMarker = {
              ...m,
              position: { left: newX, top: newY }
            };
            updatedMarker.pan = new Animated.ValueXY();
            return updatedMarker;
          }
          return m;
        });
        
        setMarkers(newMarkers);
      },
      onPanResponderEnd: () => {
        if (isEditMode) {
          setIsDragging(false);
        }
      },
      onPanResponderTerminate: () => {
        if (isEditMode) {
          setIsDragging(false);
        }
      }
    });
  };

  const handleSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need media library permissions to save the image.');
        return;
      }

      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = await viewShotRef.current.capture({
        format: "jpg",
        quality: 0.8,
      });
      await MediaLibrary.saveToLibraryAsync(result);
      setIsCapturing(false);
      setShowSuccess(true);  // Show success message instead of alert
    } catch (error) {
      setIsCapturing(false);
      console.error('Error saving image:', error);
      alert('Failed to save image.');
    }
  };

  const captureAndShare = async () => {
    try {
      setIsCapturing(true);  // Show header before capture
      
      // Wait longer for the header and logo to render properly
      await new Promise(resolve => setTimeout(resolve, 500));  // Increased from 100 to 500ms
      
      // Capture the view
      const result = await viewShotRef.current.capture({
        format: "jpg",
        quality: 0.8, // Add this to ensure consistent results
      });

      setIsCapturing(false);  // Hide header after capture

      // Share the image
      await Share.share({
        url: result,
        message: 'Check out my vocabulary from Pinata!',
      });
    } catch (error) {
      setIsCapturing(false);
      console.error('Error sharing image:', error);
      alert('Failed to share image.');
    }
  };

  // Set up the header button when component mounts
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        loading ? <></> : <TouchableOpacity 
          onPress={captureAndShare}
          style={styles.shareButton}
        >
          <Image 
            source={require('./assets/share.png')}  // Make sure to add a share icon to your assets
            style={styles.shareIcon}
          />
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
        >
          <Image source={require('./assets/back.png')} style={styles.backIcon} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, loading]);

  // Add this function to handle edit mode toggle
  const handleEditModeToggle = () => {
    const newEditMode = !isEditMode;
    setIsEditMode(newEditMode);
    
    // If entering edit mode, scroll to top
    if (newEditMode) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  // Update handleDeleteWord to handle both markers and vocabularyData
  const handleDeleteWord = (indexToDelete) => {
    // Keep the current positions of remaining markers
    setMarkers(prevMarkers => prevMarkers.filter((_, index) => index !== indexToDelete));
    setVocabularyData(prevData => prevData.filter((_, index) => index !== indexToDelete));
    setZIndexOrder(prevOrder => prevOrder
      .filter(index => index !== indexToDelete)
      .map(index => index > indexToDelete ? index - 1 : index));
    setSelectedMarker(null);
  };

  // Add this near the top with other imports
  const LoadingIndicator = () => {
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      const animate = () => {
        Animated.loop(
          Animated.timing(rotation, {
            toValue: 1,
            duration: 1500,  // Increased duration for smoother animation
            useNativeDriver: true,
            easing: Easing.bezier(0.45, 0, 0.55, 1),  // Using bezier curve for smoother movement
          }),
          {
            iterations: -1,
          }
        ).start();
      };

      animate();
      
      return () => {
        rotation.stopAnimation();
      };
    }, []);

    const spin = rotation.interpolate({
      inputRange: [0, 0.5, 1],  // Three points for smoother interpolation
      outputRange: ['-5deg', '15deg', '-5deg'],  // Return to center position
      extrapolate: 'clamp'
    });

    return (
      <View style={styles.loadingContainer}>
        <Animated.Image
          source={require('./assets/loading.png')}
          style={[
            styles.loadingImage,
            { transform: [{ rotate: spin }] }
          ]}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {loading ? (
        <View style={styles.loadingScreen}>
          <LoadingIndicator />
          <Text style={styles.loadingText}>Let's see what you can learn </Text> 
          <Text style={styles.loadingText}>from this moment! 🧐</Text>
        </View>
      ) : (
        <>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView} 
            scrollEnabled={!isDragging && !isEditMode}
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
                      {!isCapturing && selectedMarker === index && (  // Only show delete button for selected marker
                        <TouchableOpacity 
                          style={styles.deleteButton}
                          onPress={() => {
                            handleDeleteWord(index);
                            setSelectedMarker(null);  // Clear selection after delete
                          }}
                        >
                          <Text style={styles.deleteButtonText}>×</Text>
                        </TouchableOpacity>
                      )}
                      <View style={styles.markerContent}>
                        {item.type === 'atmosphere' && <Text style={styles.vocabularyType}>Theme</Text>}
                        <Text style={styles.vocabularyWord}>{item.spanish}</Text>
                        <Text style={styles.grayText}>{item.english}</Text>
                      </View>
                    </Animated.View>
                  );
                })}
                <Animated.View 
                  style={[
                    styles.editButton,
                    isEditMode && styles.editButtonActive,
                    { opacity: isCapturing || loading ? 0 : 1 }
                  ]}
                >
                  <TouchableOpacity 
                    onPress={handleEditModeToggle}
                  >
                    <Text style={styles.editButtonText}>
                      {isEditMode ? 'Done' : 'Arrange Tags'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <View style={styles.gptContainer}>
                {loading ? (
                  <LoadingIndicator />
                ) : vocabularyData && vocabularyData.length > 0 ? (
                  <View style={styles.vocabularyContainer}>
                    {isEditMode && <View style={styles.overlay} />}
                    {vocabularyData.map((item, index) => (
                      <View key={index} style={styles.vocabularyItem}>
                        <Text style={styles.vocabularyText}>
                          <Text style={[styles.vocabularyText, styles.mainText]}>{item.spanish}</Text>
                          <Text style={[styles.vocabularyText, styles.regularText]}> - {item.english}</Text>
                          <Text style={[styles.vocabularyText, styles.smallText]}> ({item.wordType})</Text>
                        </Text>
                        <Text style={[styles.vocabularyText, styles.smallText]}>{item.pronunciation}</Text>
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
                  <View style={styles.noVocabularyContainer}>
                    <Text style={styles.noVocabularyText}>Oops! No words found </Text>
                    <Text style={styles.noVocabularyText}>Can you give me one more chance? 🥺</Text>
                  </View>
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
            <View style={styles.spacing}></View>
          </ScrollView>
          
          <Animated.View 
            style={[
              styles.saveButton,
              { opacity: isCapturing || isEditMode || loading ? 0 : 1 }
            ]}
          >
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.editButtonText}>
                Save as Image
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      <SuccessMessage 
        visible={showSuccess}
        message="Yay! Image is saved! 🤩"
        onHide={() => setShowSuccess(false)}
      />
    </View>
  );
}

// Main App Component
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: '#7744C2',  // This sets the back button color
        }}
      >
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
    gap: 10,
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
    marginBottom: 10,
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
    minWidth: 100,  // Fixed width instead of minWidth
    height: 80,  // Fixed height
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
    justifyContent: 'center',  // Center content vertically
    width: '100%',
    height: '100%',  // Take full height of parent
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
    marginBottom: 4,
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
    color: '#7744C2', 
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
  grayText: {
    fontSize: 14,
    color: '#666',
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
    // marginBottom: 10,  // Space between logo and buttons
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
  editButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(119, 68, 194, 0.7)', // Purple with transparency
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    elevation: 5,
    zIndex: 100,
  },
  saveButton: {
    position: 'absolute',
    bottom: 30,  // Increased bottom margin
    right: 20,
    backgroundColor: 'rgba(212, 60, 143, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  editButtonActive: {
    backgroundColor: 'rgba(212, 60, 143, 0.9)', // Pink with transparency
  },
  editButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14,
    paddingVertical: 2,
  },
  successMessage: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(212, 60, 143, 0.9)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
  },
  successMessageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  shareIcon: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
  },
  deleteButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 16,  // Match fontSize
    textAlign: 'center',
    fontWeight: 'bold',
    height: 16,      // Match fontSize
    width: 16,       // Match fontSize
    marginTop: -1,   // Fine-tune vertical position
  },
  noVocabularyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D43C8F',
    textAlign: 'center',
    marginTop: 10,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingImage: {
    width: 150,  // Made slightly larger
    height: 150,  // Made slightly larger
    resizeMode: 'contain',
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D43C8F',
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: 'center',
    fontFamily: 'Pacifico',
  },
  noVocabularyContainer: {
    marginTop: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(128, 128, 128, 0.5)',  // Semi-transparent gray
    zIndex: 1,
  },
  taglineText: {
    fontSize: 20,
    color: '#D43C8F',
    textAlign: 'center',
    fontFamily: 'Pacifico',
    paddingHorizontal: 20,
    lineHeight: 30,
  },
  taglineText2: {
    marginBottom: 20,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: 24,
    height:  21,
    marginRight: 10,
    tintColor: 'white',  // This will make the icons white
  },
  spacing: {
    height: 70,
  },
});
