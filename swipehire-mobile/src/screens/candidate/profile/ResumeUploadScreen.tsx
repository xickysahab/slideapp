import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/ui/Button';
import { ApiError, NetworkError } from '../../../services/api/client';
import { resumeApi } from '../../../services/api/endpoints';
import { tokens } from '../../../theme/tokens';
import { type } from '../../../theme/typography';
import { SetupScaffold } from '../../onboarding/SetupScaffold';

/**
 * Resume upload and parsing — Frontend Spec §9, candidate screens 6 and 7.
 *
 * The two screens are merged. The spec's separate "parsing status" screen is marked simplified for
 * the demo ("a single spinner and 'Extracting your skills…' is fine"), and parsing takes a couple
 * of seconds, so pushing a whole screen for it would flash more than it would inform.
 *
 * The file goes straight from the device to storage via a signed URL; it never passes through our
 * API. See docs/BACKEND.md §3.3.
 */

type Phase = 'idle' | 'uploading' | 'parsing';

export interface ResumeUploadScreenProps {
  onParsed: (skills: string[]) => void;
  onSkip: () => void;
}

export function ResumeUploadScreen({ onParsed, onSkip }: ResumeUploadScreenProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  async function pickAndUpload() {
    setError(null);

    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setFileName(asset.name);

    try {
      setPhase('uploading');
      const { uploadUrl, key } = await resumeApi.requestUpload();
      await resumeApi.uploadFile(uploadUrl, asset.uri);

      setPhase('parsing');
      const result = await resumeApi.parse(key);
      onParsed(result.skills);
    } catch (err) {
      setPhase('idle');

      if (err instanceof NetworkError) {
        setError("Couldn't reach the server. Check your connection and try again.");
      } else if (err instanceof ApiError) {
        // The server distinguishes "not a PDF" from "a PDF we couldn't read" from "a scan with no
        // text", and each needs a different fix from the user, so its message is shown as-is.
        setError(err.message);
      } else {
        setError("That file couldn't be uploaded. Try a different export.");
      }
    }
  }

  return (
    <SetupScaffold
      step={2}
      totalSteps={4}
      title="Add your resume"
      subtitle="We'll read your skills off it. You get to correct them on the next screen."
      primaryLabel={fileName ? 'Choose a different file' : 'Choose a PDF'}
      onPrimary={pickAndUpload}
      busy={busy}
      secondaryLabel="Skip and add skills by hand"
      onSecondary={onSkip}
      error={error}
    >
      <View style={styles.dropzone}>
        {busy ? (
          <>
            <ActivityIndicator color={tokens.color.primary} />
            <Text style={[type('bodyM'), styles.status]}>
              {phase === 'uploading' ? 'Uploading…' : 'Extracting your skills…'}
            </Text>
            {fileName && (
              <Text style={[type('caption'), styles.fileName]} numberOfLines={1}>
                {fileName}
              </Text>
            )}
          </>
        ) : (
          <>
            <View style={styles.mark} />
            <Text style={[type('bodyM'), styles.status]}>
              {fileName ?? 'No file chosen yet'}
            </Text>
            <Text style={[type('caption'), styles.hint]}>PDF only, up to 10 MB</Text>
          </>
        )}
      </View>
    </SetupScaffold>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.color.surfaceAlt,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderStyle: 'dashed',
    padding: tokens.spacing.xl,
  },
  mark: {
    width: tokens.spacing.xl,
    height: tokens.spacing.xl,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.color.primaryTint,
    marginBottom: tokens.spacing.sm,
  },
  status: { color: tokens.color.textPrimary, textAlign: 'center' },
  fileName: { color: tokens.color.textSecondary, maxWidth: '80%' },
  hint: { color: tokens.color.textSecondary },
});
