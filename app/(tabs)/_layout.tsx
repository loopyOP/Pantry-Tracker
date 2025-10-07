{/* Layout for the tab navigator https://docs.expo.dev/router/advanced/tabs/ */} 
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Tabs } from 'expo-router';
import { Slot } from 'expo-router';

export default function TabLayout() { 
  // This creates a tab navigator at the bottom of the screen
  //  with two tabs: Home and Profile
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: 'green', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <FontAwesome size={28} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="Scan"
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: ({ color }) => <AntDesign name="scan" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
