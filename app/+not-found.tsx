import { View, Text } from "react-native";

export default function NotFoundScreen() {
    return ( 
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 20, marginBottom: 20 }}>404 - Page Not Found</Text>
            <Text>The page you are looking for does not exist.</Text>
        </View>
    );
}