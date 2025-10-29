import { Text, View } from "react-native";
import { StyleSheet } from "react-native";
import { Image } from "react-native";

export default function UserInfo({user}: {user: {username: string; email: string}}) {
    return (
        <View>
            <View style={{alignItems: 'center', marginBottom: 20,}}>
                <Image source={require('@assets/images/favicon.png')} style={{width: 100, height: 100, marginBottom: 10,}} />
            </View>
            <View>
                <Text style={styles.infoText}>Username: {user.username}</Text>
                <Text style={styles.infoText}>Email: {user.email}</Text>
            </View>
        </View>
    );
  }

const styles = StyleSheet.create({
    infoText: {
        fontSize: 18,
        marginBottom: 8,
    },
});