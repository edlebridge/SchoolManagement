import { Tabs } from 'expo-router';
import { CalendarCheck, Hop as Home, MessageCircle, Users, User, BookOpen, ClipboardCheck, GraduationCap, ChartBar as BarChart3, FileText } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DrawerHeader, DrawerLayout, type DrawerItem } from '@/components/MobileDrawer';

const items: DrawerItem[] = [
  { label: 'Dashboard', href: '/(teacher)', icon: Home },
  { label: 'Students', href: '/(teacher)/students', icon: Users },
  { label: 'Attendance', href: '/(teacher)/attendance', icon: CalendarCheck },
  { label: 'Homework', href: '/(teacher)/homework', icon: BookOpen },
  { label: 'Exam Sessions', href: '/(teacher)/exams', icon: ClipboardCheck },
  { label: 'Marks', href: '/(teacher)/marks', icon: GraduationCap },
  { label: 'Results', href: '/(teacher)/results', icon: BarChart3 },
  { label: 'Messages', href: '/(teacher)/messages', icon: MessageCircle },
  { label: 'Requests', href: '/(teacher)/requests', icon: FileText },
  { label: 'Profile', href: '/(teacher)/profile', icon: User },
];

export default function TeacherLayout() {
  const { colors } = useTheme();
  return <DrawerLayout items={items}><Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 70, paddingBottom: 10, paddingTop: 8, backgroundColor: colors.surface, borderTopColor: colors.border }, header: ({ route }) => <DrawerHeader title={route.name === 'index' ? 'Dashboard' : route.name.charAt(0).toUpperCase() + route.name.slice(1)} /> }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
    <Tabs.Screen name="students" options={{ title: 'Students', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <CalendarCheck color={color} size={size} /> }} />
    <Tabs.Screen name="homework" options={{ title: 'Homework', tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} /> }} />
    <Tabs.Screen name="exams" options={{ title: 'Exams', tabBarIcon: ({ color, size }) => <ClipboardCheck color={color} size={size} /> }} />
    <Tabs.Screen name="marks" options={{ title: 'Marks', tabBarIcon: ({ color, size }) => <GraduationCap color={color} size={size} /> }} />
    <Tabs.Screen name="results" options={{ title: 'Results', tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }} />
    <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
    <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
  </Tabs></DrawerLayout>;
}
