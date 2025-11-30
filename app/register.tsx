import { Text, View, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import React from 'react';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Formik } from 'formik';
import * as yup from 'yup';
import { useRegister } from '@/hooks/useRegister';
import { useLogin } from '@/hooks/useLogin';
import { PressableStateCallbackType } from 'react-native';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';

const registerValidationSchema = yup.object().shape({
    email: yup
        .string()
        .email('Please enter a valid email')
        .required('Email is required'),
    username: yup
        .string()
        .required('Username is required'),
    password: yup
        .string()
        .min(6, 'Password must be at least 6 characters')
        .required('Password is required'),
    confirmPassword: yup
        .string()
        .oneOf([yup.ref('password'), undefined], 'Passwords must match')
        .required('Confirm Password is required'),
});

export default function RegisterScreen() {
    // Load the Passion One font
    const [fontsLoaded] = useFonts({
        PassionOne_400Regular,
    });

    const loginMutation = useLogin();
    const registerMutation = useRegister(
        (_data, variables) => {
            // Automatically initiate login using registered credentials
            loginMutation.mutate({ email: variables.email, password: variables.password });
        }
    );
    const handleSubmit = (values: { email: string; username: string; password: string; confirmPassword: string }) => {
        registerMutation.mutate({ email: values.email, username: values.username, password: values.password });
    };

    // Create dynamic styles based on font loading
    const primaryGreen = '#00510f';
    const lightGrey = '#e0e0e0';

    const getStyles = () => StyleSheet.create({
        pageContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 60,
            backgroundColor: "#ffffff",
        },
        registerHeaderContainer: {
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
        },
        registerHeaderText: {
            fontSize: 30,
            fontWeight: "400",
            color: primaryGreen,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
        },
        textboxContainer: {
            marginTop: 50,
            width: 300,
            minWidth: 200
        },
        textbox: {
            width: 300,
            height: 50,
            borderColor: primaryGreen,
            borderWidth: 3,
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            backgroundColor: lightGrey,
            textAlign: 'center',
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
            fontWeight: '400',
            fontSize: 25,
            lineHeight: 28,
        },
        registerButton: {
            backgroundColor: primaryGreen,
            paddingVertical: 16,
            paddingHorizontal: 80,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 10,
        },
        registerButtonText: {
            color: "#fff",
            fontWeight: "400",
            fontSize: 25,
            lineHeight: 28,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
        },
        errorText: {
            color: 'red',
            fontSize: 10
        },
        signInContainer:{
            marginTop: 20,
            alignItems: "center",
            justifyContent: "center"
        },
        authSwitchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 32,
            gap: 8
        },
        authSwitchPrompt: {
            fontSize: 14,
            color: '#333',
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
            fontWeight: '400'
        },
        authSwitchButton: {
            borderColor: primaryGreen,
            borderWidth: 2,
            paddingVertical: 6,
            paddingHorizontal: 16,
            borderRadius: 20,
            backgroundColor: '#ffffff',
        },
        authSwitchButtonText: {
            fontSize: 14,
            color: primaryGreen,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
            fontWeight: '600'
        },
        statusContainer: {
            marginTop: 12,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: primaryGreen,
            backgroundColor: '#f5fff5'
        },
        statusText: {
            color: primaryGreen,
            fontSize: 14,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System'
        },
        statusError: {
            color: '#b00020',
            fontSize: 14,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System'
        },
        statusWarning: {
            color: '#b36b00',
            fontSize: 14,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System'
        }
    });

    const styles = getStyles();
    
    // Don't render until fonts are loaded or we've determined they failed to load
    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Loading fonts...</Text>
            </View>
        );
    }
    
    return (
    <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} // tweak offset if needed
    >
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.pageContainer}>
        <View style={styles.registerHeaderContainer}>
            <Image source={require('@assets/icons/pantry-guard-logo.png')} style={{width: 200, height: 200}} />
        </View>
        <View>
            <Formik
                validationSchema={registerValidationSchema}
                initialValues={{ email: '', username: '', password: '', confirmPassword: '' }}
                onSubmit={handleSubmit}
            >
                {({ handleChange, handleBlur, handleSubmit, values, errors, isValid }) => (
                    <View style={styles.textboxContainer}>
                        <TextInput
                            placeholder="email address"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor="#666"
                            onChangeText={handleChange('email')}
                            onBlur={handleBlur('email')}
                            value={values.email}
                            style={styles.textbox}
                        />
                        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                        <TextInput
                            placeholder="username"
                            autoCapitalize="none"
                            placeholderTextColor="#666"
                            onChangeText={handleChange('username')}
                            onBlur={handleBlur('username')}
                            value={values.username}
                            style={styles.textbox}
                        />
                        {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
                        <TextInput
                            placeholder="password"
                            placeholderTextColor="#666"
                            onChangeText={handleChange('password')}
                            onBlur={handleBlur('password')}
                            value={values.password}
                            secureTextEntry
                            style={styles.textbox}
                        />
                        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                        <TextInput
                            placeholder="confirm password"
                            placeholderTextColor="#666"
                            onChangeText={handleChange('confirmPassword')}
                            onBlur={handleBlur('confirmPassword')}
                            value={values.confirmPassword}
                            secureTextEntry
                            style={styles.textbox}
                        />
                        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                                                <Pressable
                                                        style={[styles.registerButton, (registerMutation.isPending || loginMutation.isPending) && { opacity: 0.6 }]}
                                                        onPress={handleSubmit as any}
                                                        disabled={!isValid || registerMutation.isPending || loginMutation.isPending}
                                                >
                                                        <Text style={styles.registerButtonText}>
                                                                {registerMutation.isPending || loginMutation.isPending ? 'creating...' : 'register'}
                                                        </Text>
                                                </Pressable>
                                                {(registerMutation.isPending || loginMutation.isPending || registerMutation.isError || (registerMutation.isSuccess && loginMutation.isError)) && (
                                                    <View style={styles.statusContainer}>
                                                        { (registerMutation.isPending || loginMutation.isPending) && (
                                                            <Text style={styles.statusText}>⏳ Creating account & signing in…</Text>
                                                        )}
                                                        { registerMutation.isError && (
                                                            <Text style={styles.statusError}>❌ {(registerMutation.error as Error).message}</Text>
                                                        )}
                                                        { registerMutation.isSuccess && loginMutation.isError && (
                                                            <Text style={styles.statusWarning}>⚠ Registered, but login failed: {(loginMutation.error as Error).message}</Text>
                                                        )}
                                                    </View>
                                                )}
                    </View>
                )}
            </Formik>
            <View style={styles.authSwitchContainer}>
                <Text style={styles.authSwitchPrompt}>Already have an account?</Text>
                <Link href="/login" asChild>
                    <Pressable style={styles.authSwitchButton}>
                        <Text style={styles.authSwitchButtonText}>Sign in</Text>
                    </Pressable>
                </Link>
            </View>
        </View>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}