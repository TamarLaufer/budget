import { Card, MutedText, ScrollScreen, Title } from "@/components/ui/Layout";
import { strings } from "@/strings/he";
import { colors } from "@/theme";
import { KeyboardAvoidingView, Platform } from "react-native";

function AuthLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollScreen withTopInset>
        <Title>{strings.APP_NAME}</Title>
        <MutedText style={{ textAlign: "center" }}>{title}</MutedText>
        <Card>{children}</Card>
      </ScrollScreen>
    </KeyboardAvoidingView>
  );
}

export default AuthLayout;