import { useContext, useState } from 'react';
import { HelpOutline as HelpOutlineIcon, UploadFile as UploadFileIcon } from '@mui/icons-material';
import { Box, Card, CardContent, Collapse, Divider, Typography } from '@mui/material';

import CustomButton from '@/components/button/CustomButton';
import { B3Upload } from '@/components/upload/B3Upload';
import { dispatchEvent } from '@/hooks/useB2BCallback';
import { useBlockPendingAccountViewPrice } from '@/hooks/useBlockPendingAccountViewPrice';
import { useB3Lang } from '@/lib/lang';
import { addProductToBcShoppingList, addProductToShoppingList } from '@/shared/service/b2b';
import { useAppSelector } from '@/store';
import { getValidOptionsList } from '@/utils/b3Product/b3Product';
import { snackbar } from '@/utils/b3Tip';

import { getAllModifierDefaultValue } from '../../../utils/b3Product/shared/config';
import { ShoppingListDetailsContext } from '../context/ShoppingListDetailsContext';

import QuickAdd from './QuickAdd';
import SearchProduct from './SearchProduct';

interface AddToListProps {
  updateList: () => void;
  isB2BUser: boolean;
  type?: string;
}

export default function AddToShoppingList(props: AddToListProps) {
  const {
    state: { id },
  } = useContext(ShoppingListDetailsContext);

  const companyStatus = useAppSelector(({ company }) => company.companyInfo.status);
  const { updateList, isB2BUser, type: pageType = '' } = props;
  const b3Lang = useB3Lang();

  const [isOpenBulkLoadCSV, setIsOpenBulkLoadCSV] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [blockPendingAccountViewPrice] = useBlockPendingAccountViewPrice();

  const addItemsToShoppingList = isB2BUser ? addProductToShoppingList : addProductToBcShoppingList;

  const addToList = async (products: CustomFieldItems[]) => {
    try {
      if (!dispatchEvent('on-add-to-shopping-list', products)) {
        throw new Error();
      }

      const items = products.map((product) => {
        const newOptionLists = getValidOptionsList(product.newSelectOptionList, product);
        return {
          optionList: newOptionLists,
          productId: product.id,
          quantity: product.quantity,
          variantId: product.variantId,
        };
      });

      await addItemsToShoppingList({
        shoppingListId: id,
        items,
      });

      snackbar.success(b3Lang('shoppingList.addToShoppingList.productsAdded'));
    } catch (e: any) {
      if (e.message.length > 0) {
        snackbar.error(e.message);
      }
    }
  };

  const quickAddToList = async (products: CustomFieldItems[]) => {
    const items = products.map((product) => {
      const newOptionLists = getValidOptionsList(
        product.newSelectOptionList || product.optionList,
        product?.products || product,
      );
      return {
        optionList: newOptionLists || [],
        productId: parseInt(product.productId, 10) || 0,
        quantity: product.quantity,
        variantId: parseInt(product.variantId, 10) || 0,
      };
    });

    await addItemsToShoppingList({
      shoppingListId: id,
      items,
    });

    snackbar.success(b3Lang('shoppingList.addToShoppingList.productsAdded'));
  };

  const getValidProducts = (products: CustomFieldItems) => {
    const notPurchaseSku: string[] = [];
    const productItems: CustomFieldItems[] = [];
    const notAddAble: string[] = [];

    products.forEach((item: CustomFieldItems) => {
      const { products: currentProduct, qty } = item;
      const { option, purchasingDisabled, variantSku, variantId, productId, modifiers } =
        currentProduct;

      const defaultModifiers = getAllModifierDefaultValue(modifiers);
      if (purchasingDisabled && pageType !== 'shoppingList') {
        notPurchaseSku.push(variantSku);
        return;
      }

      const notPassedModifier = defaultModifiers.filter(
        (modifier: CustomFieldItems) => !modifier.isVerified,
      );
      if (notPassedModifier.length > 0) {
        notAddAble.push(variantSku);

        return;
      }

      const optionsList = option.map((item: CustomFieldItems) => ({
        optionId: `attribute[${item.option_id}]`,
        optionValue: item.id.toString(),
      }));

      defaultModifiers.forEach((modifier: CustomFieldItems) => {
        const { type } = modifier;

        if (type === 'date') {
          const { defaultValue } = modifier;
          Object.keys(defaultValue).forEach((key) => {
            optionsList.push({
              optionId: `attribute[${modifier.option_id}][${key}]`,
              optionValue: `${modifier.defaultValue[key]}`,
            });
          });
        } else {
          optionsList.push({
            optionId: `attribute[${modifier.option_id}]`,
            optionValue: `${modifier.defaultValue}`,
          });
        }
      });

      productItems.push({
        productId: parseInt(productId, 10) || 0,
        variantId: parseInt(variantId, 10) || 0,
        quantity: Number(qty),
        optionList: optionsList,
        products: item.products,
      });
    });

    return {
      notPurchaseSku,
      productItems,
      notAddAble,
    };
  };

  const handleCSVAddToList = async (productsData: CustomFieldItems) => {
    setIsLoading(true);
    try {
      const { validProduct } = productsData;

      const { notPurchaseSku, productItems, notAddAble } = getValidProducts(validProduct);

      if (productItems.length > 0) {
        await quickAddToList(productItems);

        updateList();
      }

      if (notAddAble.length > 0 && pageType !== 'shoppingList') {
        snackbar.error(
          b3Lang('shoppingList.addToShoppingList.skuNotAddable', {
            notAddAble: notAddAble.join(', '),
          }),
        );
      }

      if (notPurchaseSku.length > 0 && pageType !== 'shoppingList') {
        snackbar.error(
          b3Lang('shoppingList.addToShoppingList.skuNotPurchasable', {
            notPurchaseSku: notPurchaseSku.join(', '),
          }),
        );
      }

      setIsOpenBulkLoadCSV(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUploadDiag = () => {
    if (blockPendingAccountViewPrice && companyStatus === 0) {
      snackbar.info(
        'Your business account is pending approval. This feature is currently disabled.',
      );
    } else {
      setIsOpenBulkLoadCSV(true);
    }
  };

  return (
    <Card
      sx={{
        marginBottom: '50px',
      }}
    >
      <CardContent>
        <Box>
          <Typography variant="h5">{b3Lang('shoppingList.addToShoppingList.addToList')}</Typography>
          <SearchProduct updateList={updateList} addToList={addToList} type="shoppingList" />

          <Divider />

          <QuickAdd type="shoppingList" updateList={updateList} quickAddToList={quickAddToList} />

          <Divider />

          <Box
            sx={{
              margin: '20px 0 0',
            }}
          >
            <CustomButton variant="text" onClick={() => handleOpenUploadDiag()}>
              <UploadFileIcon
                sx={{
                  marginRight: '8px',
                }}
              />
              {b3Lang('shoppingList.addToShoppingList.bulkUploadCsv')}
            </CustomButton>
          </Box>

          <Box sx={{ margin: '8px 0 0' }}>
            <CustomButton
              variant="text"
              onClick={() => setShowInstructions((prev) => !prev)}
            >
              <HelpOutlineIcon sx={{ marginRight: '8px' }} />
              Instructions
            </CustomButton>
          </Box>

          <Collapse in={showInstructions}>
            <Box
              sx={{
                mt: 1,
                p: 2,
                backgroundColor: '#f5f5f5',
                borderRadius: 1,
                fontSize: '1rem',
                lineHeight: 1.6,
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', fontSize: '1rem' }}>
                To use a sample CSV file to upload SKUs to your Add to Cart list
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                <li>
                  Click &quot;BULK UPLOAD CSV&quot; and then &quot;Download sample&quot;
                </li>
                <li>
                  &quot;variant_sku&quot; (Column A) is your desired SKU and &quot;qty&quot; (Column
                  B) is your desired quantity
                </li>
                <li>
                  It is important that the SKU values in the variant_sku field match the SKUs
                  available on the Store
                  <ul>
                    <li>Make sure to include any dashes or underscores</li>
                    <li>
                      If a SKU in your CSV file cannot be found in the Store, then it will not be
                      added to your Add to Cart list
                    </li>
                  </ul>
                </li>
                <li>
                  Do not change the Row 1 headings. Fill in variant_sku and qty in rows 2 and below
                </li>
                <li>
                  Once the sample CSV file is complete, save it as a .CSV file
                  <ul>
                    <li>
                      If using Windows Excel: Click on File &gt; Save As &gt; File Format &gt;
                      Comma Separated Values (.csv)
                    </li>
                    <li>If using Mac Numbers: Click on File &gt; Export To &gt; CSV</li>
                  </ul>
                </li>
                <li>Click Upload File and select your CSV file from your file explorer</li>
                <li>
                  As SKUs are matched to available products in the Store, you will see the items
                  populate on the Add to Cart list
                  <ul>
                    <li>
                      If an item appears in red, then it was not matched to an available item in the
                      Store
                    </li>
                  </ul>
                </li>
                <li>Review the items and then click &quot;Add Products to Cart&quot;</li>
              </Box>
            </Box>
          </Collapse>

          <B3Upload
            isOpen={isOpenBulkLoadCSV}
            setIsOpen={setIsOpenBulkLoadCSV}
            handleAddToList={handleCSVAddToList}
            isLoading={isLoading}
            withModifiers
          />
        </Box>
      </CardContent>
    </Card>
  );
}
