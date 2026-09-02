import { Tabs } from 'expo-router';
import { CalendarCheck, Hop as Home, MessageCircle, BookOpen, User, ChartBar as BarChart3, ClipboardCheck, FileText } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ParentMobileProvider } from '@/context/ParentMobileContext';
import { DrawerHeader, DrawerLayout, type DrawerItem } from '@/components/MobileDrawer';

const items: DrawerItem[] = [
  { label: 'Dashboard', href: '/(parent)', icon: Home },
  { label: 'Attendance', href: '/(parent)/attendance', icon: CalendarCheck },
  { label: 'Homework', href: '/(parent)/homework', icon: BookOpen },
  { label: 'Exams', href: '/(parent)/exams', icon: ClipboardCheck },
  { label: 'Results', href: '/(parent)/results', icon: BarChart3 },
  { label: 'Messages', href: '/(parent)/messages', icon: MessageCircle },
  { label: 'Requests', href: '/(parent)/requests', icon: FileText },
  { label: 'Profile', href: '/(parent)/profile', icon: User },
];

export default function ParentLayout() {
  const { colors } = useTheme();
  return (
    <ParentMobileProvider>
      <DrawerLayout items={items}>
        <Tabs screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 8, backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          header: ({ route }) => <DrawerHeader title={route.name === 'index' ? 'Dashboard' : route.name.charAt(0).toUpperCase() + route.name.slice(1)} />,
        }}>
          <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
          <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} /> }} />
          <Tabs.Screen name="homework" options={{ title: 'Homework', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
          <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
          <Tabs.Screen name="exams" options={{ title: 'Exams', tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} />, href: null }} />
          <Tabs.Screen name="results" options={{ title: 'Results', tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} />, href: null }} />
          <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />, href: null }} />
          <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} />, href: null }} />
        </Tabs>
      </DrawerLayout>
    </ParentMobileProvider>
  );
}
