// 돋보기 아이콘이 있는 검색 입력창 (재료 추가 화면, 냉장고 화면에서 같이 씀)
// 글자를 입력하면 오른쪽에 X 버튼이 생겨 한 번에 지울 수 있습니다.
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { CloseIcon, SearchIcon } from './Icons'
import { colors } from '../theme/colors'

export function SearchBar({ value, onChangeText, placeholder = '재료 검색', autoFocus = false, style }) {
  return (
    <View style={[styles.box, style]}>
      <SearchIcon size={18} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSub}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} accessibilityLabel="검색어 지우기" hitSlop={8}>
          <CloseIcon />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none', // 웹에서 입력창 테두리가 두 겹으로 보이지 않게
  },
})
