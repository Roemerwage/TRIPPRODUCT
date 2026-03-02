import { Redirect, Tabs } from "expo-router";
import { Calendar, Map, Home, Package, Users } from "lucide-react-native";
import React from "react";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useTrip } from "@/contexts/TripContext";

export default function TabLayout() {
  const { colors } = useThemeMode();
  const { isLoading, hasActiveTrip, needsProfileSetup } = useTrip();

  if (!isLoading && hasActiveTrip && needsProfileSetup) {
    return <Redirect href="/profile-setup" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="planning"
        options={{
          title: "Planning",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Kaart",
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="accommodations"
        options={{
          title: "Verblijven",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          title: "Crew",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="packing"
        options={{
          title: "Paklijst",
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
