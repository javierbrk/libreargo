import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants";
import { BigButton } from "./ui";
import { IcoCampana, IcoChevron, IcoX } from "./icons";
import { NTFY_INSTALL_LINKS } from "../services/notifyApi/ntfyInstallLinks";
import { tryOpenUrl } from "../services/notifyApi/ntfyDeepLink";

interface NtfySubscribeSheetProps {
  readonly visible: boolean;
  readonly topic: string;
  readonly onRetry: () => void;
  readonly onClose: () => void;
}

const INSTALL_OPTIONS = [
  { label: "Google Play", url: NTFY_INSTALL_LINKS.playStore },
  { label: "F-Droid", url: NTFY_INSTALL_LINKS.fdroid },
  { label: "GitHub (APK)", url: NTFY_INSTALL_LINKS.githubReleases },
] as const;

/**
 * Guía de instalación de la app ntfy cuando el deep link de suscripción
 * (ntfy://…) no encontró ninguna app que lo maneje. "Ya la instalé,
 * reintentar" vuelve a intentar el mismo deep link.
 */
export function NtfySubscribeSheet({
  visible,
  topic,
  onRetry,
  onClose,
}: NtfySubscribeSheetProps) {
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(24, insets.bottom + 20);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          testID="ntfy-subscribe-sheet"
          style={styles.sheet}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <IcoCampana size={24} color={COLORS.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Instalá ntfy</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {topic}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.85}
            >
              <IcoX size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.explainer}>
            No encontramos la app ntfy en tu teléfono. Instalala y volvé a
            intentar para recibir alertas aunque LibreAgro esté cerrado.
          </Text>

          <View style={styles.list}>
            {INSTALL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                style={styles.row}
                onPress={() => {
                  void tryOpenUrl(option.url);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.rowLabel}>{option.label}</Text>
                <IcoChevron size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
            <View style={styles.applySlot}>
              <BigButton label="Ya la instalé, reintentar" onPress={onRetry} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxHeight: "82%",
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.divider,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: COLORS.surface,
  },
  explainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 14,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  applySlot: {
    flex: 1,
  },
});
