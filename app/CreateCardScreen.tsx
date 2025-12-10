import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { usePartner } from '../contexts/PartnerContext';
import { cardService, CARD_TEMPLATES } from '../services/cards';
import { encryptionService } from '../services/encryption';
import { partnerService } from '../services/partner';

type CardType = 'text' | 'voice';

export default function CreateCardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { partner } = usePartner();
  const [cardType, setCardType] = useState<CardType>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleTemplateSelect = (templateId: string) => {
    const template = CARD_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setTextContent(template.text + ' ');
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Please grant microphone permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri || null);
      setRecording(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const handleSave = async () => {
    if (!user?.partnerId || !partner) {
      Alert.alert('Error', 'Partner connection required');
      return;
    }

    if (cardType === 'text' && !textContent.trim()) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    if (cardType === 'text' && textContent.length > 200) {
      Alert.alert('Error', 'Text must be 200 characters or less');
      return;
    }

    if (cardType === 'voice' && !recordingUri) {
      Alert.alert('Error', 'Please record a voice message');
      return;
    }

    setSaving(true);
    try {
      // Get shared secret
      const partnerPublicKey = await partnerService.getPartnerPublicKey(
        user.id,
        user.partnerId
      );
      const sharedSecret = await encryptionService.getSharedSecret(
        user.partnerId,
        partnerPublicKey
      );

      if (cardType === 'text') {
        await cardService.createTextCard(
          user.partnerId,
          user.id,
          textContent.trim(),
          selectedTemplate || undefined,
          sharedSecret
        );
      } else {
        await cardService.createVoiceCard(
          user.partnerId,
          user.id,
          recordingUri!,
          sharedSecret
        );
      }

      Alert.alert('Success', 'Card created successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create a Card</Text>

        {/* Card Type Selection */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              cardType === 'text' && styles.typeButtonActive,
            ]}
            onPress={() => setCardType('text')}
          >
            <Text
              style={[
                styles.typeButtonText,
                cardType === 'text' && styles.typeButtonTextActive,
              ]}
            >
              Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              cardType === 'voice' && styles.typeButtonActive,
            ]}
            onPress={() => setCardType('voice')}
          >
            <Text
              style={[
                styles.typeButtonText,
                cardType === 'voice' && styles.typeButtonTextActive,
              ]}
            >
              Voice
            </Text>
          </TouchableOpacity>
        </View>

        {/* Templates (Text only) */}
        {cardType === 'text' && (
          <View style={styles.templatesSection}>
            <Text style={styles.sectionTitle}>Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CARD_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    selectedTemplate === template.id && styles.templateCardActive,
                  ]}
                  onPress={() => handleTemplateSelect(template.id)}
                >
                  <Text
                    style={[
                      styles.templateText,
                      selectedTemplate === template.id && styles.templateTextActive,
                    ]}
                  >
                    {template.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Text Input */}
        {cardType === 'text' && (
          <View style={styles.inputSection}>
            <TextInput
              style={styles.textInput}
              placeholder="What would you like to say?"
              value={textContent}
              onChangeText={setTextContent}
              multiline
              maxLength={200}
              editable={!saving}
            />
            <Text style={styles.charCount}>
              {textContent.length}/200
            </Text>
          </View>
        )}

        {/* Voice Recording */}
        {cardType === 'voice' && (
          <View style={styles.voiceSection}>
            {!recordingUri ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <Text style={styles.recordButtonText}>
                  {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
                </Text>
                {isRecording && (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={styles.recordingIndicator}
                  />
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.recordingComplete}>
                <Text style={styles.recordingCompleteText}>✓ Recording saved</Text>
                <TouchableOpacity
                  style={styles.rerecordButton}
                  onPress={() => {
                    setRecordingUri(null);
                    setIsRecording(false);
                  }}
                >
                  <Text style={styles.rerecordButtonText}>Record Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Card</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#6366f1',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  templatesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  templateCard: {
    padding: 16,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 200,
  },
  templateCardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  templateText: {
    fontSize: 14,
    color: '#666',
  },
  templateTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    minHeight: 120,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  charCount: {
    textAlign: 'right',
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  voiceSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#6366f1',
    padding: 20,
    borderRadius: 50,
    minWidth: 200,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  recordButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  recordingIndicator: {
    marginLeft: 8,
  },
  recordingComplete: {
    alignItems: 'center',
  },
  recordingCompleteText: {
    fontSize: 16,
    color: '#10b981',
    marginBottom: 12,
    fontWeight: '600',
  },
  rerecordButton: {
    padding: 12,
  },
  rerecordButtonText: {
    color: '#6366f1',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

