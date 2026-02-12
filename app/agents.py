"""

## One time due amounts

Scene 1
User: Dinner date with girlfriend, Total bill is 5K. Bill needs to be split equally

Scene 2
User: Dinner date with girlfriend, Total bill is 5K. I will pay for th drink and she will pay for the food.

Scene 3
User: Weekend vacation with Shivam. Record petrol charges for car of 7K. Needs to be split equally.

Scene 4
User: Weekend vacation with Shivam. Record room charges of Rs 3K. He owes the total amount.

Scene 5
User: Brunch with office friends at Bier Library. Total bill needs to be split equally.

Scene 6
User: Brunch with office friends at Daddy's. Total 4 people - Shivam, Yashasvi and Anjali. Anjali will pay only 1000rs while remaining amount split equally between the other 3.

## Amount that needs to be collected over a period of time

Scene 1
User: I gave 5800 rs to Sunita my cook for her phone. I will recover this amount by Jun 2026.

Scene 2
User: Anita's salary is 4500 rs per month. I have already paid her advance 500rs for her kid's fees and 500rs again for some emergency as cash. Record this so that I don't forget this when I am paying her salary.

# Different kinds of things I would like the agent to do. 

1. Create a ticket by identifying the following details
    - identify type of the ticket - one time, recurring
    - people who owe me money and how much
    - ticket description
    - equal/unequal split
    - payment settlement due date
2. Update ticket details
    - Mark a payment as settled
    - Update the split amount
    - bill total amount
    - due date
    - In case of recurring payments only, update the due amount when person owing the amount has paid an installment. Mark the transaction date
3. Close tickets when the amount is settled

"""