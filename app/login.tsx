import { Text, View, StyleSheet, Pressable, TextInput, ScrollView} from 'react-native';
import React from 'react';
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Formik } from 'formik';
import * as yup from 'yup';
import { useLogin } from '@/hooks/useLogin';
import { useFonts, PassionOne_400Regular } from '@expo-google-fonts/passion-one';

const loginValidationSchema = yup.object().shape({
  email: yup
    .string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .required('Password is required'),
});


export default function Index() {
    // Load the Passion One font
    const [fontsLoaded] = useFonts({
        PassionOne_400Regular,
    });

    const loginMutation = useLogin();
    const handleSubmit = (values: { email: string; password: string }) => {
        loginMutation.mutate(values);
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
        loginHeaderContainer: {
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
        },
        loginHeaderText: {
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
            height: 60,
            borderColor: primaryGreen,
            borderWidth: 3,
            marginBottom: 10,
            padding: 10,
            borderRadius: 14,
            backgroundColor: lightGrey,
            textAlign: 'center',
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
            fontWeight: '400',
            fontSize: 25,
            lineHeight: 28,
        },
        loginButton: {
            backgroundColor: primaryGreen,
            paddingVertical: 16,
            paddingHorizontal: 80,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 10,
        },
        loginButtonText: {
            color: "#fff",
            fontWeight: "400",
            fontSize: 25,
            lineHeight: 28,
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
        },
        forgotPasswordContainer: {
            marginTop: 1,
            marginBottom: 10,
        },
        forgotPasswordText: {
            color: primaryGreen,
            textDecorationLine: "underline",
            fontFamily: fontsLoaded ? 'PassionOne_400Regular' : 'System',
        },
        signUpContainer:{
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
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
    <View style={styles.pageContainer}>
        <View style={styles.loginHeaderContainer}>
            <Image source={require('@assets/icons/pantry-guard-logo.png')} style={{width: 200, height: 200}} />
        </View>
        <View>
            <Formik
                validationSchema={loginValidationSchema}
                initialValues={{ email: '', password: '' }}
                onSubmit={handleSubmit}
            >
                {({ handleChange, handleBlur, handleSubmit, values, errors, isValid }) => (
                    <View style={styles.textboxContainer}>
                        <TextInput
                            placeholder="email address"
                            autoCapitalize="none"
                            placeholderTextColor="#666"
                            style={styles.textbox}
                            onChangeText={handleChange('email')}
                            onBlur={handleBlur('email')}
                            value={values.email}
                            keyboardType="email-address"
                        />
                        {errors.email &&
                            <Text style={{ fontSize: 10, color: 'red' }}>{errors.email}</Text>
                        }
                        <TextInput
                            placeholder="password"
                            placeholderTextColor="#666"
                            autoCapitalize="none"
                            style={styles.textbox}
                            onChangeText={handleChange('password')}
                            onBlur={handleBlur('password')}
                            value={values.password}
                            secureTextEntry
                        />
                        {errors.password &&
                            <Text style={{ fontSize: 10, color: 'red' }}>{errors.password}</Text>
                        }
                        <View style={styles.forgotPasswordContainer}>
                            <Link href="/" asChild>
                                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                            </Link>
                        </View>
                            <Pressable
                                style={styles.loginButton}
                                onPress={handleSubmit as any}
                                disabled={!isValid}
                            >
                                <Text style={styles.loginButtonText}>sign in</Text>
                            </Pressable>
                            {loginMutation.isPending && <Text>⏳ Logging in...</Text>}
                            {loginMutation.isSuccess && <Text>✅ Logged in!</Text>}
                            {loginMutation.isError && (
                            <Text style={{ color: "red" }}>
                                ❌ {(loginMutation.error as Error).message}
                            </Text>
                            )}
                    </View>
                )}
            </Formik>
            <View style={styles.signUpContainer}>
                <Text>Don't have an account?
                    <Link href="./register" asChild>
                        <Text style={{ color: 'blue' , textDecorationLine: 'underline'}}> Sign Up</Text>
                    </Link>
                </Text>
            </View>
        </View>
    </View>
    </ScrollView>
  );
}
