import { Text, View, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import React from 'react';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Formik } from 'formik';
import * as yup from 'yup';
import { useRegister } from '@/hooks/useRegister';
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

    const registerMutation = useRegister();
    const handleSubmit = (values: { email: string; username: string; password: string; confirmPassword: string }) => {
        registerMutation.mutate(values);
    };

    // Create dynamic styles based on font loading
    const getStyles = () => StyleSheet.create({
        pageContainer: {
            flex: 1,
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 60,
            backgroundColor: "#f8f8f8ff",
        },
        registerHeaderContainer: {
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
        },
        registerHeaderText: {
            fontSize: 30,
            fontWeight: "bold"
        },
        textboxContainer: {
            marginTop: 50,
            width: 300,
            minWidth: 200
        },
        textbox: {
            width: 300,
            height: 50,
            borderColor: '#03A903',
            borderWidth: 3,
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            backgroundColor: "#D9D9D9",
            textAlign: 'center',
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
            fontWeight: '400',
            fontSize: 25,
            lineHeight: 28,
        },
        registerButton: {
            backgroundColor: "#03A903",
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
                            style={styles.registerButton}
                            onPress={handleSubmit as any}
                            disabled={!isValid}
                        >
                            <Text style={styles.registerButtonText}>register</Text>
                        </Pressable>
                        {registerMutation.isPending && <Text>⏳ Registering...</Text>}
                        {registerMutation.isSuccess && <Text>✅ Registered!</Text>}
                        {registerMutation.isError && (
                        <Text style={{ color: "red" }}>
                            ❌ {(registerMutation.error as Error).message}
                        </Text>
                        )}
                    </View>
                )}
            </Formik>
            <View style={styles.signInContainer}>
                <Text>Already have an account?
                    <Link href="/login" asChild>
                        <Text style={{ color: 'blue', textDecorationLine: 'underline' }}> Sign In</Text>
                    </Link>
                </Text>
            </View>
        </View>
    </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}