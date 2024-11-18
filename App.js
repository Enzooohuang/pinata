import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, PanResponder, Animated, Share, Easing, Alert, Linking, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect, useRef, useCallback } from 'react';
import { OPENAI_API_KEY } from '@env';
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from 'expo-media-library';
import logo from './assets/logo.png';
import logoFull from './assets/logofull.png';
import { useFonts } from 'expo-font';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as StoreReview from 'expo-store-review';
import spanishPrompt from './Prompts/spanish';
import generalPrompt from './Prompts/general';
import frenchPrompt from './Prompts/french';
import chinesePrompt from './Prompts/chinese';
import japanesePrompt from './Prompts/japanese';
import koreanPrompt from './Prompts/korean';
import italianPrompt from './Prompts/italian';
import hindiPrompt from './Prompts/hindi';
import * as SplashScreen from 'expo-splash-screen';

const Stack = createNativeStackNavigator();
const screenWidth = Dimensions.get('window').width;

// Add these constants at the top of the file
const DAILY_LIMIT = 10;
const STORAGE_KEY = 'dailyUsage';

// Add this interface at the top of the file
const parseVocabularyData = (response) => {
  try {
    const match = response.match(/<vocabulary>([\s\S]*?)<\/vocabulary>/);
    if (match && match[1]) {
      const vocabularyItems = match[1]
        .trim()
        .split('\n')
        .map(line => {
          line = line.trim();
          if (line.length === 0) return null;
          
          try {
            const parsedItem = JSON.parse(line);
            return parsedItem;
          } catch (e) {
            return null;
          }
        })
        .filter(item => item !== null);
      
      return vocabularyItems;
    }
    return null;
  } catch (error) {
    return [];
  }
};

// Add this new component
function SuccessMessage({ visible, message, onHide}) {
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
    <Animated.View style={[styles.successMessage, { opacity: fadeAnim, backgroundColor: '#7744C2' }]}>
      <Text style={styles.successMessageText}>{message}</Text>
    </Animated.View>
  );
}

// Add these functions to handle daily limit
const checkDailyLimit = async () => {
  try {
    const today = new Date().toDateString();
    const usageData = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (usageData) {
      const { date, count } = JSON.parse(usageData);
      
      // If it's a new day, reset the count
      if (date !== today) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          date: today,
          count: 0
        }));
        return { canProceed: true, remainingAttempts: DAILY_LIMIT };
      }
      
      // Check if limit is reached
      if (count >= DAILY_LIMIT) {
        return { canProceed: false, remainingAttempts: 0 };
      }
      
      return { canProceed: true, remainingAttempts: DAILY_LIMIT - count };
    }
    
    // First time usage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: today,
      count: 0
    }));
    return { canProceed: true, remainingAttempts: DAILY_LIMIT };
  } catch (error) {
    console.error('Error checking daily limit:', error);
    return { canProceed: false, remainingAttempts: 0 };
  }
};

const incrementUsageCount = async () => {
  try {
    const today = new Date().toDateString();
    const usageData = await AsyncStorage.getItem(STORAGE_KEY);
    
    if (usageData) {
      const { count } = JSON.parse(usageData);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: today,
        count: count + 1
      }));
    }
  } catch (error) {
    console.error('Error incrementing usage count:', error);
  }
};

// Add this near the top of your file
const LANGUAGES = [
  { id: 'spanish', label: 'Spanish' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'french', label: 'French' },
  { id: 'italian', label: 'Italian' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'korean', label: 'Korean' },
];

// Home Screen Component
function HomeScreen({ navigation, isLoggedIn, userInfo, handleLogout }) {
  const [remainingAttempts, setRemainingAttempts] = useState(DAILY_LIMIT);
  const [showLimitMessage, setShowLimitMessage] = useState(false);
  const [language, setLanguage] = useState('spanish');

  // Update useEffect to also run when screen comes into focus
  useEffect(() => {
    const checkAttempts = async () => {
      const { remainingAttempts } = await checkDailyLimit();
      setRemainingAttempts(remainingAttempts);
    };

    const unsubscribe = navigation.addListener('focus', () => {
      checkAttempts();
    });

    // Initial check
    checkAttempts();

    // Cleanup subscription
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => {
              navigation.navigate('Login', { isLoggedIn: isLoggedIn, userInfo: userInfo, handleLogout: handleLogout });
          }}
        >
          <Image 
            source={require('./assets/settings.png')}
            style={{ width: 25, height: 25 }}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isLoggedIn, userInfo]);

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
      // Request permission - removed config object
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status === 'denied' && !permissionResult.canAskAgain) {
        Alert.alert(
          "Permission Required",
          "To add vocabulary tags to your photos, Piñata needs access to your photo library. Please enable it in your device settings.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }

      if (permissionResult.status !== 'granted') {
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

        await incrementUsageCount();
        // Navigate to result screen with base64 data
        navigation.navigate('Result', { 
          imageBase64: result.assets[0].base64,
          imageUri: result.assets[0].uri,
          language: language
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Error picking image: ' + error.message);
    }
  };

  const takePhoto = async () => {
    try {
      // Request permission - removed config object
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

      if (cameraPermission.status === 'denied' && !cameraPermission.canAskAgain) {
        Alert.alert(
          "Permission Required",
          "To add vocabulary tags to your camera photos, Piñata needs access to your camera. Please enable it in your device settings.",
          [
            { text: "Open Settings", onPress: () => Linking.openSettings() },
            { text: "Cancel", style: "cancel" }
          ]
        );
        return;
      }

      if (cameraPermission.status !== 'granted') {
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 1,
        base64: true,
      });

      if (!result.canceled) {
        await incrementUsageCount();
        navigation.navigate('Result', { 
          imageBase64: result.assets[0].base64,
          imageUri: result.assets[0].uri,
          language: language
        });
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      alert('Error taking photo: ' + error.message);
    }
  };

  const handleImageAction = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const { canProceed, remainingAttempts: attempts } = await checkDailyLimit();
    setRemainingAttempts(attempts);

    if (!canProceed) {
      setShowLimitMessage(true);
      return;
    }
    pickImage();
  };

  const handleCameraAction = async () => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }

    const { canProceed, remainingAttempts: attempts } = await checkDailyLimit();
    setRemainingAttempts(attempts);

    if (!canProceed) {
      setShowLimitMessage(true);
      return;
    }
    takePhoto();
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('./assets/logohome.png')}
        style={styles.homeLogo}
      />
      <Text style={styles.taglineText}>
        Turn any moment into a
      </Text>
      <View style={styles.languageContainer}>
        <TouchableOpacity 
          style={styles.languageSelector}
          onPress={() => {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                options: [...LANGUAGES.map(lang => lang.label), 'Cancel'],
                cancelButtonIndex: LANGUAGES.length,
              },
              (buttonIndex) => {
                if (buttonIndex < LANGUAGES.length) {
                  setLanguage(LANGUAGES[buttonIndex].id);
                }
              }
            );
          }}
        >
          <Text style={styles.languageText}>
            {LANGUAGES.find(l => l.id === language)?.label}
          </Text>
          <Image 
            source={require('./assets/dropdown.png')}  // Add a small dropdown arrow icon
            style={styles.dropdownIcon}
          />
        </TouchableOpacity>
        <Text style={[styles.taglineText, styles.taglineText2]}>
          learning opportunity! 🎉
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.button, styles.libraryButton]}
        onPress={handleImageAction}
      >
        <View style={styles.buttonContent}>
          <Image 
            source={require('./assets/image.png')}
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>CHOOSE a moment</Text>
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, styles.cameraButton]}
        onPress={handleCameraAction}
      >
        <View style={styles.buttonContent}>
          <Image 
            source={require('./assets/camera.png')}
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
      <SuccessMessage 
        visible={showLimitMessage}
        message="You've reached your daily limit. Come back tomorrow! 🌟"
        onHide={() => setShowLimitMessage(false)}
      />
    </View>
  );
}

// Result Screen Component
function ResultScreen({ route, navigation }) {
  const { imageBase64, imageUri, language } = route.params;
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

  const choosePrompt = () => {
    switch (language) {
      case 'spanish': return spanishPrompt;
      case 'french': return frenchPrompt;
      case 'italian': return italianPrompt;
      case 'chinese': return chinesePrompt;
      case 'hindi': return hindiPrompt;
      case 'italian': return italianPrompt;
      case 'japanese': return japanesePrompt;
      case 'korean': return koreanPrompt;
      default: return generalPrompt(language);
    }
  }

  useEffect(() => {
    Image.getSize(imageUri, (width, height) => {
      const scaledHeight = (height / width) * screenWidth;
      setImageHeight(scaledHeight);
      setImageWidth(screenWidth);
    });
  }, [imageUri]);

  const callChatGPT = async () => {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

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
              content: `You are a helpful assistant that can analyze images and provide a list of vocabulary words in english and ${language}.`
            },
            {
              role: 'user',
              content: [
                {type: 'image_url', image_url: {url: `data:image/jpeg;base64,${imageBase64}`}},
                {type: 'text', text: choosePrompt()}
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.5,
        }),
        signal: controller.signal  // Add abort signal
      });

      clearTimeout(timeoutId);  // Clear timeout if request succeeds

      const data = await result.json();
      if (data.choices && data.choices.length > 0) {
        const response = data.choices[0].message.content;
        const parsedData = parseVocabularyData(response);
        if (parsedData) {
          setVocabularyData(parsedData);
        }
      } else {
        setVocabularyData([]);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request timed out');
        setVocabularyData([]);
      } else {
        console.error('Error calling ChatGPT API:', error);
        setVocabularyData([]);
      }
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
  }, [imageBase64, imageUri, language]);

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
        message: 'Check out my vocabulary from Piñata!',
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
      )
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
          <Text style={[styles.smallText, styles.loadingTextSmall]}>(may take ~15s)</Text>
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
                        <Text style={styles.vocabularyWord}>{item.word}</Text>
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
                          <Text style={[styles.vocabularyText, styles.mainText]}>{item.word}</Text>
                          <Text style={[styles.vocabularyText, styles.regularText]}> - {item.english}</Text>
                          <Text style={[styles.vocabularyText, styles.smallText]}> ({item.wordType})</Text>
                        </Text>
                        <Text style={[styles.vocabularyText, styles.smallText]}>{item.pronunciation}</Text>
                        {item.conjugations && <Text style={styles.vocabularyText}>
                          {item.conjugations.map((conjugation, i) => (
                              i === 0 ? (
                                <Text key={i} style={styles.conjugationText}>
                                  {conjugation}
                                </Text>
                              ) : (
                                <Text key={i} style={styles.conjugationText}>
                                  {' '}/ {conjugation}
                                </Text>
                              )
                            ))}
                          </Text>
                        }
                        <Text>
                        <Text style={styles.vocabularyText}>
                          e.g. {
                            item.sentence.split(new RegExp(`(${[item.word, ...item.conjugations || []].join('|')})`, 'gi'))
                            .map((part, i) => (
                              [item.word, ...item.conjugations || []].some(word => 
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
                  <View style={styles.captureHeaderRow}>
                    <Text style={styles.captureHeaderText}>Created by </Text>
                    <Image
                      source={logoFull}
                      style={styles.captureHeaderLogo}
                    />
                  </View>
                  <Text style={styles.captureWebsiteText}>www.learnpinata.com</Text>
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

// Update LoginScreen component
function LoginScreen({ navigation, storeUserData, isLoggedIn, userInfo, handleLogout }) {
  const [remainingAttempts, setRemainingAttempts] = useState(DAILY_LIMIT);

  // Add useEffect to check remaining attempts
  useEffect(() => {
    const checkAttempts = async () => {
      const { remainingAttempts } = await checkDailyLimit();
      setRemainingAttempts(remainingAttempts);
    };

    if (isLoggedIn) {
      checkAttempts();
    }
  }, [isLoggedIn]);

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      const userData = {
        id: credential.user,
        email: credential.email,
        name: credential.fullName?.givenName,
        provider: 'apple'
      };
      
      await storeUserData(userData);
      navigation.goBack();
      
    } catch (e) {
      if (e.code === 'ERR_CANCELED') {
        console.log('User canceled Apple Sign In');
      } else {
        console.error('Apple Sign In error:', e);
      }
    }
  };

  const handleWaitlist = async () => {
    await WebBrowser.openBrowserAsync('https://forms.gle/JfXFTZomAyEMRCis8');
  };

  const handleStoreReview = async () => {
    try {
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    } catch (error) {
      console.log('Error requesting review:', error);
    }
  };

  return (
    <View style={styles.loginContainer}>
      <Image
        source={require('./assets/logohome.png')}
        style={styles.loginLogo}
      />
      
      {isLoggedIn ? (
        <View style={styles.userInfoContainer}>
          {
            remainingAttempts <= 0 ? (
              <Text style={[styles.attemptsText, styles.attemptsText2]}> {
                "You've reached your daily limit. \nCome back tomorrow! 🌟"
              }
              </Text>
            ) : remainingAttempts === 1 ? (
              <>
                <Text style={styles.attemptsText}> You have <Text style={styles.boldText}>1</Text> attempt remaining</Text>
                <Text style={[styles.attemptsText, styles.attemptsText2]}>for today 🥹</Text>
              </>
            ) : (
              <>
                <Text style={styles.attemptsText}> You have <Text style={styles.boldText}>{remainingAttempts}</Text> attempts remaining</Text>
                <Text style={[styles.attemptsText, styles.attemptsText2]}>for today 🥹</Text>
              </>
            )
          }
          
          <TouchableOpacity 
            style={styles.waitlistButton}
            onPress={handleWaitlist}
          >
            <Text style={styles.waitlistButtonText}>Not enough? Join the waitlist! 🎉</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reviewButton}
            onPress={handleStoreReview}
          >
            <Text style={styles.reviewButtonText}>Love Piñata? Rate us! ⭐️</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => {
              handleLogout();
              navigation.goBack();
            }}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.loginTitle}>Login to start learning</Text>
          {AppleAuthentication.isAvailableAsync() && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}
        </>
      )}
    </View>
  );
}

// Main App Component
export default function App() {
  const [fontsLoaded] = useFonts({
    'Pacifico': require('./assets/fonts/Pacifico-Regular.ttf'),
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [appIsReady, setAppIsReady] = useState(false);

  // Add storeUserData and handleLogout functions here
  const storeUserData = async (userData) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUserInfo(userData);
      setIsLoggedIn(true);
    } catch (error) {
      console.error('Error storing user data:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userData');
      setUserInfo(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const checkLoginState = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        setUserInfo(JSON.parse(userData));
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error('Error checking login state:', error);
    }
  };

  useEffect(() => {
    async function prepare() {
      try {
        await checkLoginState();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!fontsLoaded || !appIsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <Image
          source={require('./assets/splash.png')}
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerTintColor: '#D43C8F',
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen 
            name="Home" 
            options={{
              headerTitle: () => (
                <Image
                  source={logo}
                  style={{ width: 90, height: 30, resizeMode: 'contain' }}
                />
              ),
              headerTitleAlign: 'center',
            }}
          >
            {(props) => (
              <HomeScreen 
                {...props}
                isLoggedIn={isLoggedIn}
                userInfo={userInfo}
                handleLogout={handleLogout}
              />
            )}
          </Stack.Screen>
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
          <Stack.Screen 
            name="Login" 
            options={{
              headerTitle: () => (
                <Image
                  source={logo}
                  style={{ width: 90, height: 30, resizeMode: 'contain' }}
                />
              ),
              headerTitleAlign: 'center',
            }}
          >
            {(props) => (
              <LoginScreen 
                {...props}
                storeUserData={storeUserData}
                isLoggedIn={isLoggedIn}
                userInfo={userInfo}
                handleLogout={handleLogout}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 6,
    borderRadius: 8,
    minWidth: 80,  // Fixed width instead of minWidth
    minHeight: 60,  // Fixed height
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
    marginBottom: 2,
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
    marginBottom: 2,
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
  loadingTextSmall: {
    marginTop: 10,
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
  },
  captureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureHeaderText: {
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  captureHeaderLogo: {
    width: 150,
    height: 90,
    resizeMode: 'contain',
    marginRight: 10,
  },
  captureWebsiteText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 5,
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
    color: '#D43C8F',
    marginTop: 10,
    paddingHorizontal: 20,
    textAlign: 'center',
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
  loginContainer: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLogo: {
    width: screenWidth * 0.5,
    height: screenWidth * 0.5,
    resizeMode: 'contain',
  },
  loginTitle: {
    fontSize: 24,
    fontFamily: 'Pacifico',
    color: '#D43C8F',
    marginBottom: 30,
    textAlign: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    width: '100%',
  },
  loginButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  appleButton: {
    width: '100%',
    height: 50,
    marginTop: 10,
  },
  userInfoContainer: {
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: 'Pacifico',
    color: '#D43C8F',
    marginBottom: 10,
  },
  emailText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 5,
    marginTop: 70,
  },
  logoutButtonText: {
    color: 'black',
    fontSize: 14,
    fontWeight: '600',
  },
  attemptsText: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  attemptsText2: {
    marginTop: 10,
    marginBottom: 30,
  },
  waitlistButton: {
    backgroundColor: '#7744C2',  // Different color from logout button
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 15,  // Space between waitlist and logout buttons
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  waitlistButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewButton: {
    backgroundColor: '#D43C8F',  // iOS green color
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginTop: 10,
  },
  reviewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginHorizontal: 5,
  },
  languageText: {
    color: '#D43C8F',
    fontSize: 20,
    fontFamily: 'Pacifico',
    marginRight: 5,
  },
  dropdownIcon: {
    width: 14,
    height: 8,
    tintColor: '#D43C8F',
  },
});
